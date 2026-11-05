"""Bounded, encrypted Kakao review samples and aggregate comparison reports."""

from __future__ import annotations

import hashlib
import json
import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from cryptography.fernet import InvalidToken

from .review_analysis import analyze_reviews, build_insights
from .review_capture import CaptureBatch, CaptureTarget, PublicReviewBrowserCollector, cipher_from_key
from .schemas import (
    AreaReviewReportResponse,
    AreaReviewTopic,
    CapturedReviewReportResponse,
    ReviewAggregateSide,
    ReviewAggregateTopic,
    ReviewAreaSummary,
    ReviewPeerSample,
    ReviewPlaceRef,
)
from .trade_area_geometry import AreaLocation, locate_area


REPORT_DIR = Path(__file__).resolve().parents[2] / "database" / "raw" / "reviews"
MIN_REVIEWS_PER_PLACE = 5
MIN_TOTAL_REVIEWS = 30
REQUIRED_PLACES = 3
FULL_TOTAL_REVIEWS = 50
FULL_PLACES = 5
MAX_NEW_RUNS_PER_USER_MONTH = 5
RETENTION_DAYS = 90
MAX_PEER_DISTANCE_M = 1200


def append_audit(directory: Path, *, event: str, place_count: int = 0, review_count: int = 0,
                 failed_count: int = 0, removed_count: int = 0, now: datetime | None = None) -> None:
    """Record counts and outcome only, without place IDs, names, URLs or review text."""
    directory.mkdir(parents=True, exist_ok=True)
    entry = {
        "at": (now or datetime.now(timezone.utc)).isoformat(),
        "event": event,
        "provider": "kakao",
        "place_count": place_count,
        "review_count": review_count,
        "failed_count": failed_count,
        "removed_count": removed_count,
    }
    with (directory / "audit.jsonl").open("a", encoding="utf-8") as audit:
        audit.write(json.dumps(entry, ensure_ascii=False) + "\n")


def distance_m(left: ReviewPlaceRef, right: ReviewPlaceRef) -> int:
    latitude = math.radians((left.latitude + right.latitude) / 2)
    dx = math.radians(left.longitude - right.longitude) * math.cos(latitude)
    dy = math.radians(left.latitude - right.latitude)
    return round(math.hypot(dx, dy) * 6_371_000)


def select_peer_places(
    own: ReviewPlaceRef,
    candidates: list[ReviewPlaceRef],
    own_area_code: str | None,
    locator: Callable[[float, float], AreaLocation] = locate_area,
    limit: int = 4,
) -> list[tuple[ReviewPlaceRef, bool]]:
    unique: dict[str, tuple[ReviewPlaceRef, bool, int]] = {}
    for candidate in candidates:
        if candidate.id == own.id or candidate.id in unique:
            continue
        distance = distance_m(own, candidate)
        if distance > MAX_PEER_DISTANCE_M:
            continue
        location = locator(candidate.latitude, candidate.longitude) if own_area_code else None
        same_area = bool(location and location.status == "inside" and location.code == own_area_code)
        unique[candidate.id] = (candidate, same_area, distance)
    ranked = sorted(unique.values(), key=lambda item: (not item[1], item[2]))[:limit]
    return [(place, same_area) for place, same_area, _ in ranked]


def _report_path(directory: Path, area_code: str, own_id: str, month: str, industry_code: str = "CS100010") -> Path:
    basis = f"{area_code}:{own_id}:{month}" if industry_code == "CS100010" else f"{area_code}:{own_id}:{industry_code}:{month}"
    digest = hashlib.sha256(basis.encode()).hexdigest()[:24]
    return directory / f"report-{month}-{digest}.json"


def _user_hash(user_id: str) -> str:
    return hashlib.sha256(user_id.encode()).hexdigest()[:24]


def _read_report(path: Path, now: datetime) -> dict | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if datetime.fromisoformat(payload["expires_at"]) > now:
            return payload
    except FileNotFoundError:
        return None
    except (OSError, ValueError, KeyError, TypeError):
        pass
    path.unlink(missing_ok=True)
    return None


def purge_expired_reports(directory: Path, now: datetime) -> int:
    removed = 0
    for path in list(directory.glob("report-*.json")) + list(directory.glob("area-report-*.json")):
        if _read_report(path, now) is None and not path.exists():
            removed += 1
    return removed


def purge_expired_captures(directory: Path, now: datetime) -> int:
    """Remove pilot capture files once their 90-day retention period ends."""
    removed = 0
    for path in directory.glob("capture-*.json"):
        try:
            captured_at = datetime.fromisoformat(json.loads(path.read_text(encoding="utf-8"))["captured_at"])
        except (OSError, ValueError, KeyError, TypeError):
            continue
        if captured_at + timedelta(days=RETENTION_DAYS) <= now:
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def _side(stats) -> ReviewAggregateSide:
    return ReviewAggregateSide(
        mentions=stats.mentions,
        positive=stats.positive,
        negative=stats.negative,
        neutral=stats.neutral,
    )


def build_captured_report(
    payload: dict,
    area: ReviewAreaSummary | None,
    encryption_key: str,
    from_cache: bool,
    location_status: str = "inside",
    area_distance_m: int | None = None,
    industry_code: str = "CS100010",
    industry_name: str = "커피-음료",
) -> CapturedReviewReportResponse:
    cipher = cipher_from_key(encryption_key)
    grouped: dict[str, list[str]] = {"OWN": [], "A": [], "B": [], "C": [], "D": []}
    for review in payload.get("reviews", []):
        label = review.get("peer_label")
        if label not in grouped or review.get("provider") != "kakao":
            continue
        try:
            grouped[label].append(cipher.decrypt(review["encrypted_text"].encode("utf-8")).decode("utf-8"))
        except (InvalidToken, KeyError, UnicodeError, ValueError):
            continue
    peers = [
        ReviewPeerSample(
            label=target["label"],
            review_count=len(grouped[target["label"]]),
            same_trade_area=bool(target["same_trade_area"]),
            included_in_analysis=bool(grouped[target["label"]]),
        )
        for target in payload.get("peers", [])
        if target.get("label") in {"A", "B", "C", "D"}
    ]
    eligible_peers = [peer for peer in peers if peer.included_in_analysis]
    own_eligible = bool(grouped["OWN"])
    eligible_count = int(own_eligible) + len(eligible_peers)
    total = len(grouped["OWN"]) + sum(len(grouped[peer.label]) for peer in peers)
    analyzed_total = (len(grouped["OWN"]) if own_eligible else 0) + sum(peer.review_count for peer in eligible_peers)
    comparable = own_eligible and bool(eligible_peers)
    robust = (len(grouped["OWN"]) >= MIN_REVIEWS_PER_PLACE
              and sum(peer.review_count >= MIN_REVIEWS_PER_PLACE for peer in eligible_peers) >= 2
              and analyzed_total >= MIN_TOTAL_REVIEWS)
    full = robust and eligible_count == FULL_PLACES and all(
        peer.review_count >= MIN_REVIEWS_PER_PLACE for peer in eligible_peers
    ) and analyzed_total >= FULL_TOTAL_REVIEWS
    topics: list[ReviewAggregateTopic] = []
    insights = []
    if analyzed_total:
        own_stats = analyze_reviews(grouped["OWN"], industry_code)
        nearby_stats = analyze_reviews([text for peer in eligible_peers for text in grouped[peer.label]], industry_code)
        topics = [
            ReviewAggregateTopic(topic_key=key, label=own.label, own=_side(own), nearby=_side(nearby_stats[key]))
            for key, own in own_stats.items()
        ]
        if full:
            insights = build_insights(own_stats, nearby_stats)
    strong_place_count = int(len(grouped["OWN"]) >= MIN_REVIEWS_PER_PLACE) + sum(
        peer.review_count >= MIN_REVIEWS_PER_PLACE for peer in eligible_peers
    )
    missing_places = max(0, REQUIRED_PLACES - strong_place_count)
    strong_review_count = (len(grouped["OWN"]) if len(grouped["OWN"]) >= MIN_REVIEWS_PER_PLACE else 0) + sum(
        peer.review_count for peer in eligible_peers if peer.review_count >= MIN_REVIEWS_PER_PLACE
    )
    missing_reviews = max(0, MIN_TOTAL_REVIEWS - strong_review_count)
    message = (
        f"내 가게와 주변 {industry_name} 4곳의 적격 리뷰 50건 이상을 같은 기준으로 비교했습니다."
        if full else
        f"내 가게와 주변의 공개 리뷰 {analyzed_total}건을 주제별로 집계했습니다. 충분한 표본 기준까지 가게 {missing_places}곳·리뷰 {missing_reviews}건이 더 필요해 운영 제안은 표시하지 않습니다."
        if robust else
        f"탐색용 소규모 표본 {analyzed_total}건입니다. "
        + ("내 가게와 주변 모두에서 리뷰가 확인됐지만 비교 결론은 낼 수 없습니다. " if comparable else
           "한쪽에만 리뷰가 있어 가게 간 비교는 할 수 없습니다. ")
        + f"충분한 표본 기준까지 가게 {missing_places}곳·리뷰 {missing_reviews}건이 더 필요합니다."
        if analyzed_total else
        "확인된 공개 텍스트 리뷰가 없습니다. 수집된 리뷰 없이 주제나 평가를 만들 수 없습니다."
    )
    return CapturedReviewReportResponse(
        status="available" if full else "limited" if analyzed_total else "insufficient_sample",
        area=area,
        location_status=location_status,
        area_distance_m=area_distance_m,
        own_review_count=len(grouped["OWN"]),
        peer_samples=peers,
        total_review_count=total,
        analyzed_review_count=analyzed_total,
        eligible_place_count=eligible_count,
        required_place_count=REQUIRED_PLACES,
        required_review_count=MIN_TOTAL_REVIEWS,
        topics=topics,
        insights=insights,
        failed_labels=[label for label in payload.get("failed_labels", []) if label in grouped],
        captured_at=payload.get("captured_at"),
        expires_at=payload.get("expires_at"),
        from_cache=from_cache,
        source="kakao",
        message=message,
        industry_code=industry_code,
        industry_name=industry_name,
    )


def collect_or_load_report(
    *,
    own: ReviewPlaceRef,
    peers: list[tuple[ReviewPlaceRef, bool]],
    area: ReviewAreaSummary | None,
    user_id: str,
    encryption_key: str,
    location_status: str = "inside",
    area_distance_m: int | None = None,
    industry_code: str = "CS100010",
    industry_name: str = "커피-음료",
    directory: Path = REPORT_DIR,
    now: datetime | None = None,
    collector_factory: Callable[[str], PublicReviewBrowserCollector] = PublicReviewBrowserCollector,
) -> CapturedReviewReportResponse:
    now = now or datetime.now(timezone.utc)
    month = now.strftime("%Y%m")
    directory.mkdir(parents=True, exist_ok=True)
    purge_expired_reports(directory, now)
    purge_expired_captures(directory, now)
    area_code = area.code if area else "outside"
    path = _report_path(directory, area_code, own.id, month, industry_code)
    cached = _read_report(path, now)
    if cached is not None:
        return build_captured_report(cached, area, encryption_key, True, location_status, area_distance_m, industry_code, industry_name)
    user_hash = _user_hash(user_id)
    user_lock = directory / f"quota-{month}-{user_hash}.lock"
    report_lock = path.with_suffix(".lock")
    try:
        descriptor = os.open(user_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError("다른 리뷰 수집이 진행 중입니다. 완료 후 다시 확인해 주세요.") from error
    os.close(descriptor)
    locked_report = False
    try:
        try:
            descriptor = os.open(report_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as error:
            raise RuntimeError("이 가게의 리뷰 수집이 이미 진행 중입니다.") from error
        os.close(descriptor)
        locked_report = True
        cached = _read_report(path, now)
        if cached is not None:
            return build_captured_report(cached, area, encryption_key, True, location_status, area_distance_m, industry_code, industry_name)
        runs = 0
        for previous in list(directory.glob(f"report-{month}-*.json")) + list(directory.glob(f"area-report-{month}-*.json")):
            try:
                if json.loads(previous.read_text(encoding="utf-8")).get("requested_by_hash") == user_hash:
                    runs += 1
            except (OSError, ValueError):
                continue
        if runs >= MAX_NEW_RUNS_PER_USER_MONTH:
            raise RuntimeError("이번 달 계정별 신규 리뷰 수집 횟수를 모두 사용했습니다.")
        targets = [CaptureTarget("kakao", f"https://place.map.kakao.com/{own.id}", "OWN")]
        targets.extend(
            CaptureTarget("kakao", f"https://place.map.kakao.com/{place.id}", label)
            for (place, _), label in zip(peers, "ABCD")
        )
        batch: CaptureBatch = collector_factory(encryption_key).capture_with_failures(targets)
        captured = {
            "schema_version": 1,
            "captured_at": now.isoformat(),
            "expires_at": (now + timedelta(days=RETENTION_DAYS)).isoformat(),
            "requested_by_hash": user_hash,
            "area_code": area_code,
            "industry_code": industry_code,
            "location_status": location_status,
            "area_distance_m": area_distance_m,
            "own_place_id": own.id,
            "peers": [
                {"label": label, "place_id": place.id, "same_trade_area": same_area}
                for (place, same_area), label in zip(peers, "ABCD")
            ],
            "failed_labels": batch.failed_labels,
            "reviews": [
                {
                    "provider": review.provider,
                    "peer_label": review.peer_label,
                    "encrypted_text": review.encrypted_text.decode("utf-8"),
                    "fetched_at": review.fetched_at.isoformat(),
                }
                for review in batch.reviews
            ],
        }
        temporary = path.with_suffix(".tmp")
        try:
            temporary.write_text(json.dumps(captured, ensure_ascii=False), encoding="utf-8")
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
        append_audit(directory, event="capture", place_count=len(targets), review_count=len(batch.reviews),
                     failed_count=len(batch.failed_labels), now=now)
        return build_captured_report(captured, area, encryption_key, False, location_status, area_distance_m, industry_code, industry_name)
    finally:
        if locked_report:
            report_lock.unlink(missing_ok=True)
        user_lock.unlink(missing_ok=True)


def build_area_review_report(
    payload: dict, area: ReviewAreaSummary, industry_code: str, industry_name: str,
    encryption_key: str, from_cache: bool,
) -> AreaReviewReportResponse:
    cipher = cipher_from_key(encryption_key)
    grouped: dict[str, list[str]] = {label: [] for label in "ABCDE"}
    for review in payload.get("reviews", []):
        label = review.get("peer_label")
        if label not in grouped or review.get("provider") != "kakao":
            continue
        try:
            grouped[label].append(cipher.decrypt(review["encrypted_text"].encode()).decode())
        except (InvalidToken, KeyError, UnicodeError, ValueError):
            continue
    samples = [
        ReviewPeerSample(label=label, review_count=len(grouped[label]), same_trade_area=True,
                         included_in_analysis=bool(grouped[label]))
        for label in payload.get("place_labels", []) if label in grouped
    ]
    eligible = [sample for sample in samples if sample.included_in_analysis]
    analyzed = [text for sample in eligible for text in grouped[sample.label]]
    strong = [sample for sample in samples if sample.review_count >= MIN_REVIEWS_PER_PLACE]
    strong_review_count = sum(sample.review_count for sample in strong)
    robust = len(strong) >= REQUIRED_PLACES and strong_review_count >= MIN_TOTAL_REVIEWS
    full = robust and len(strong) == FULL_PLACES and strong_review_count >= FULL_TOTAL_REVIEWS
    topics = [
        AreaReviewTopic(topic_key=key, label=stats.label, mentions=stats.mentions,
                        positive=stats.positive, negative=stats.negative, neutral=stats.neutral)
        for key, stats in analyze_reviews(analyzed, industry_code).items()
    ] if analyzed else []
    missing_places = max(0, REQUIRED_PLACES - len(strong))
    missing_reviews = max(0, MIN_TOTAL_REVIEWS - strong_review_count)
    message = (
        f"{industry_name} 가게 5곳의 적격 리뷰 50건 이상을 상권 단위로 집계했습니다."
        if full else
        f"{industry_name} 가게 {len(strong)}곳·적격 리뷰 {strong_review_count}건의 제한 표본입니다. 개별 가게의 성과를 뜻하지 않습니다."
        if robust else
        f"탐색용 소규모 표본: {industry_name} 가게 {len(eligible)}곳의 공개 리뷰 {len(analyzed)}건을 집계했습니다. 충분한 표본 기준까지 가게 {missing_places}곳·리뷰 {missing_reviews}건이 더 필요하며, 상권 전체의 반응으로 일반화할 수 없습니다."
        if analyzed else
        "확인된 공개 텍스트 리뷰가 없습니다. 수집된 리뷰 없이 주제나 평가를 만들 수 없습니다."
    )
    return AreaReviewReportResponse(
        status="available" if full else "limited" if analyzed else "insufficient_sample",
        area=area, industry_code=industry_code, industry_name=industry_name,
        place_samples=samples, total_review_count=sum(sample.review_count for sample in samples),
        analyzed_review_count=len(analyzed), eligible_place_count=len(eligible),
        required_place_count=REQUIRED_PLACES, required_review_count=MIN_TOTAL_REVIEWS,
        topics=topics, failed_labels=[label for label in payload.get("failed_labels", []) if label in grouped],
        captured_at=payload.get("captured_at"), expires_at=payload.get("expires_at"),
        from_cache=from_cache, source="kakao", message=message,
    )


def collect_or_load_area_review_report(
    *, area: ReviewAreaSummary, industry_code: str, industry_name: str,
    places: list[ReviewPlaceRef], user_id: str, encryption_key: str,
    directory: Path = REPORT_DIR, now: datetime | None = None,
    collector_factory: Callable[[str], PublicReviewBrowserCollector] = PublicReviewBrowserCollector,
) -> AreaReviewReportResponse:
    now = now or datetime.now(timezone.utc)
    month = now.strftime("%Y%m")
    directory.mkdir(parents=True, exist_ok=True)
    purge_expired_reports(directory, now)
    purge_expired_captures(directory, now)
    digest = hashlib.sha256(f"{area.code}:{industry_code}:{month}".encode()).hexdigest()[:24]
    path = directory / f"area-report-{month}-{digest}.json"
    cached = _read_report(path, now)
    if cached is not None:
        return build_area_review_report(cached, area, industry_code, industry_name, encryption_key, True)
    user_hash = _user_hash(user_id)
    user_lock = directory / f"quota-{month}-{user_hash}.lock"
    report_lock = path.with_suffix(".lock")
    try:
        descriptor = os.open(user_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise RuntimeError("다른 리뷰 수집이 진행 중입니다. 완료 후 다시 확인해 주세요.") from error
    os.close(descriptor)
    locked_report = False
    try:
        try:
            descriptor = os.open(report_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError as error:
            raise RuntimeError("이 상권의 리뷰 수집이 이미 진행 중입니다.") from error
        os.close(descriptor)
        locked_report = True
        cached = _read_report(path, now)
        if cached is not None:
            return build_area_review_report(cached, area, industry_code, industry_name, encryption_key, True)
        runs = 0
        for previous in list(directory.glob(f"report-{month}-*.json")) + list(directory.glob(f"area-report-{month}-*.json")):
            try:
                if json.loads(previous.read_text(encoding="utf-8")).get("requested_by_hash") == user_hash:
                    runs += 1
            except (OSError, ValueError):
                continue
        if runs >= MAX_NEW_RUNS_PER_USER_MONTH:
            raise RuntimeError("이번 달 계정별 신규 리뷰 수집 횟수를 모두 사용했습니다.")
        targets = [CaptureTarget("kakao", f"https://place.map.kakao.com/{place.id}", label)
                   for place, label in zip(places[:5], "ABCDE")]
        batch: CaptureBatch = collector_factory(encryption_key).capture_with_failures(targets)
        captured = {
            "schema_version": 1, "captured_at": now.isoformat(),
            "expires_at": (now + timedelta(days=RETENTION_DAYS)).isoformat(),
            "requested_by_hash": user_hash, "area_code": area.code,
            "industry_code": industry_code, "place_labels": [target.peer_label for target in targets],
            "place_ids": [place.id for place in places[:5]], "failed_labels": batch.failed_labels,
            "reviews": [{"provider": review.provider, "peer_label": review.peer_label,
                         "encrypted_text": review.encrypted_text.decode("utf-8"),
                         "fetched_at": review.fetched_at.isoformat()} for review in batch.reviews],
        }
        temporary = path.with_suffix(".tmp")
        try:
            temporary.write_text(json.dumps(captured, ensure_ascii=False), encoding="utf-8")
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
        append_audit(directory, event="capture", place_count=len(targets), review_count=len(batch.reviews),
                     failed_count=len(batch.failed_labels), now=now)
        return build_area_review_report(captured, area, industry_code, industry_name, encryption_key, False)
    finally:
        if locked_report:
            report_lock.unlink(missing_ok=True)
        user_lock.unlink(missing_ok=True)
