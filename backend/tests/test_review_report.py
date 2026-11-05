from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from app.review_capture import CaptureBatch, CapturedReview
from app.review_report import build_area_review_report, build_captured_report, collect_or_load_area_review_report, collect_or_load_report, purge_expired_captures, purge_expired_reports, select_peer_places
from app.schemas import ReviewAreaSummary, ReviewPlaceRef
from app.trade_area_geometry import AreaLocation, load_area_polygons, locate_area


AREA = ReviewAreaSummary(code="3110135", name="공식 상권", district_name="성동구", area_type_name="골목상권")
NOW = datetime(2026, 11, 4, tzinfo=timezone.utc)


def place(place_id: str, longitude: float = 127.0648) -> ReviewPlaceRef:
    return ReviewPlaceRef(id=place_id, latitude=37.5483, longitude=longitude)


def test_official_boundary_contains_a_representative_point() -> None:
    if not list((Path(__file__).resolve().parents[2] / "database" / "raw" / "area").glob("*.zip")):
        pytest.skip("Official raw boundary archive is not available in this checkout")
    polygons, transformer = load_area_polygons()
    assert len(polygons) == 1650
    from pyproj import Transformer

    point = polygons[0].geometry.representative_point()
    longitude, latitude = Transformer.from_crs(transformer.target_crs, "EPSG:4326", always_xy=True).transform(point.x, point.y)
    assert locate_area(latitude, longitude) == AreaLocation(polygons[0].code, "inside", 0)


def test_peer_selection_prefers_same_official_area_and_limits_distance() -> None:
    own = place("1")
    candidates = [place("1"), place("2", 127.066), place("3", 127.065), place("4", 127.0649), place("5", 127.0651), place("6", 127.09)]
    def locator(_latitude: float, longitude: float) -> AreaLocation:
        return AreaLocation("3110135" if longitude < 127.0655 else "other", "inside", 0)
    selected = select_peer_places(own, candidates, AREA.code, locator)
    assert [item.id for item, _ in selected] == ["4", "3", "5", "2"]
    assert len(selected) == 4


def test_outside_official_area_selects_nearby_cafes_without_claiming_same_area() -> None:
    own = place("1")
    candidates = [place("2", 127.065), place("3", 127.0652), place("4", 127.066)]
    def unexpected_locator(_latitude: float, _longitude: float) -> AreaLocation:
        raise AssertionError("An unmapped shop has no official area to match")
    selected = select_peer_places(own, candidates, None, unexpected_locator)
    assert [item.id for item, _ in selected] == ["2", "3", "4"]
    assert all(not same_area for _, same_area in selected)


def test_aggregate_report_has_full_limited_and_insufficient_levels_without_raw_text() -> None:
    key = Fernet.generate_key().decode()
    cipher = Fernet(key.encode())
    reviews = [
        {"peer_label": label, "provider": "kakao", "encrypted_text": cipher.encrypt("커피가 맛있고 직원이 친절해요".encode()).decode()}
        for label in "OABCD" for _ in range(10)
    ]
    for review in reviews[:10]:
        review["peer_label"] = "OWN"
    payload = {
        "captured_at": NOW.isoformat(), "expires_at": "2027-02-02T00:00:00+00:00",
        "peers": [{"label": label, "same_trade_area": True} for label in "ABCD"],
        "reviews": reviews, "failed_labels": [],
    }
    report = build_captured_report(payload, AREA, key, False)
    assert report.status == "available"
    assert report.total_review_count == 50
    assert report.eligible_place_count == 5
    assert report.analyzed_review_count == 50
    assert report.topics
    assert "맛있고" not in report.model_dump_json()
    payload["reviews"] = reviews[:30]
    limited = build_captured_report(payload, AREA, key, True)
    assert limited.status == "limited"
    assert limited.analyzed_review_count == 30
    assert limited.topics
    assert limited.insights == []
    payload["reviews"] = reviews[:20]
    insufficient = build_captured_report(payload, AREA, key, True)
    assert insufficient.status == "insufficient_sample"
    assert insufficient.topics == []
    assert insufficient.insights == []


def test_sparse_peer_reviews_are_excluded_from_limited_comparison() -> None:
    key = Fernet.generate_key().decode()
    cipher = Fernet(key.encode())
    reviews = [
        {"peer_label": label, "provider": "kakao", "encrypted_text": cipher.encrypt("커피 맛이 좋아요".encode()).decode()}
        for label, count in (("OWN", 19), ("A", 20), ("B", 5), ("C", 2), ("D", 2))
        for _ in range(count)
    ]
    payload = {
        "captured_at": NOW.isoformat(), "expires_at": "2027-02-02T00:00:00+00:00",
        "peers": [{"label": label, "same_trade_area": True} for label in "ABCD"],
        "reviews": reviews, "failed_labels": [],
    }
    report = build_captured_report(payload, AREA, key, False)
    assert report.status == "limited"
    assert report.total_review_count == 48
    assert report.analyzed_review_count == 44
    assert [peer.included_in_analysis for peer in report.peer_samples] == [True, True, False, False]
    assert report.topics


def test_capture_is_encrypted_and_reused_within_the_month(tmp_path) -> None:
    key = Fernet.generate_key().decode()
    calls: list[int] = []

    class FakeCollector:
        def __init__(self, encryption_key: str):
            self.cipher = Fernet(encryption_key.encode())

        def capture_with_failures(self, targets):
            calls.append(len(targets))
            return CaptureBatch([
                CapturedReview("kakao", target.peer_label, "맛있어요", self.cipher.encrypt("맛있어요".encode()), NOW)
                for target in targets
            ], [])

    peers = [(place(str(index)), True) for index in range(2, 6)]
    inputs = dict(own=place("1"), peers=peers, area=AREA, user_id="owner", encryption_key=key, directory=tmp_path, now=NOW, collector_factory=FakeCollector)
    first = collect_or_load_report(**inputs)
    second = collect_or_load_report(**inputs)
    assert calls == [5]
    assert first.from_cache is False
    assert second.from_cache is True
    assert first.status == "insufficient_sample"
    stored = next(tmp_path.glob("report-*.json")).read_text(encoding="utf-8")
    assert "맛있어요" not in stored
    audit = (tmp_path / "audit.jsonl").read_text(encoding="utf-8")
    assert '"event": "capture"' in audit
    assert '"place_count": 5' in audit
    assert "맛있어요" not in audit
    assert "place.map.kakao.com" not in audit


def test_different_shops_get_separate_captures_and_reports(tmp_path) -> None:
    key = Fernet.generate_key().decode()
    captured_own_ids: list[str] = []

    class FakeCollector:
        def __init__(self, encryption_key: str):
            self.cipher = Fernet(encryption_key.encode())

        def capture_with_failures(self, targets):
            captured_own_ids.append(targets[0].public_url.rsplit("/", 1)[-1])
            return CaptureBatch([
                CapturedReview("kakao", target.peer_label, "커피가 좋아요", self.cipher.encrypt("커피가 좋아요".encode()), NOW)
                for target in targets for _ in range(10)
            ], [])

    for own_id in ("101", "202", "101"):
        own = place(own_id)
        peers = [(place(str(index)), True) for index in range(2, 6)]
        report = collect_or_load_report(
            own=own, peers=peers, area=AREA, user_id="owner", encryption_key=key,
            directory=tmp_path, now=NOW, collector_factory=FakeCollector,
        )
        assert report.status == "available"
    assert captured_own_ids == ["101", "202"]
    assert len(list(tmp_path.glob("report-*.json"))) == 2


def test_expired_encrypted_files_are_removed(tmp_path) -> None:
    report = tmp_path / "report-202601-old.json"
    report.write_text('{"expires_at":"2026-02-01T00:00:00+00:00"}', encoding="utf-8")
    capture = tmp_path / "capture-202601-old.json"
    capture.write_text('{"captured_at":"2026-01-01T00:00:00+00:00"}', encoding="utf-8")
    assert purge_expired_reports(tmp_path, NOW) == 1
    assert purge_expired_captures(tmp_path, NOW) == 1
    assert not report.exists()
    assert not capture.exists()


def test_area_review_report_is_anonymous_encrypted_and_cached(tmp_path) -> None:
    key = Fernet.generate_key().decode()
    calls = []

    class FakeCollector:
        def __init__(self, encryption_key: str):
            self.cipher = Fernet(encryption_key.encode())

        def capture_with_failures(self, targets):
            calls.append(len(targets))
            return CaptureBatch([
                CapturedReview("kakao", target.peer_label, "상품 품질이 좋아요",
                               self.cipher.encrypt("상품 품질이 좋아요".encode()), NOW)
                for target in targets for _ in range(10)
            ], [])

    inputs = dict(area=AREA, industry_code="CS300011", industry_name="일반의류",
                  places=[place(str(index)) for index in range(1, 6)], user_id="viewer",
                  encryption_key=key, directory=tmp_path, now=NOW, collector_factory=FakeCollector)
    first = collect_or_load_area_review_report(**inputs)
    second = collect_or_load_area_review_report(**inputs)
    assert calls == [5]
    assert first.status == "available"
    assert first.topics[0].topic_key == "product"
    assert second.from_cache
    assert [sample.label for sample in first.place_samples] == list("ABCDE")
    assert "상품 품질이 좋아요" not in first.model_dump_json()
    stored = next(tmp_path.glob("area-report-*.json")).read_text(encoding="utf-8")
    assert "상품 품질이 좋아요" not in stored
    assert "place.map.kakao.com" not in stored

    sparse = {"place_labels": list("ABC"), "captured_at": NOW.isoformat(),
              "expires_at": "2027-02-02T00:00:00+00:00", "failed_labels": [], "reviews": []}
    cipher = Fernet(key.encode())
    sparse["reviews"] = [
        {"peer_label": label, "provider": "kakao", "encrypted_text": cipher.encrypt("상품 품질이 좋아요".encode()).decode()}
        for label in "ABC" for _ in range(10)
    ]
    partial = build_area_review_report(sparse, AREA, "CS300011", "일반의류", key, False)
    assert partial.status == "limited"
    assert partial.eligible_place_count == 3
    sparse["reviews"] = []
    limited = build_area_review_report(sparse, AREA, "CS300011", "일반의류", key, False)
    assert limited.status == "insufficient_sample"
    assert limited.topics == []


def test_area_review_shares_monthly_quota_with_own_shop_reports(tmp_path) -> None:
    user_hash = hashlib.sha256("viewer".encode()).hexdigest()[:24]
    for index in range(5):
        (tmp_path / f"report-202611-{index}.json").write_text(json.dumps({
            "requested_by_hash": user_hash, "expires_at": "2027-02-02T00:00:00+00:00",
        }), encoding="utf-8")

    class UnexpectedCollector:
        def __init__(self, _key):
            raise AssertionError("Quota must stop capture before the collector starts")

    with pytest.raises(RuntimeError, match="횟수"):
        collect_or_load_area_review_report(
            area=AREA, industry_code="CS100010", industry_name="커피-음료",
            places=[place("1"), place("2"), place("3")], user_id="viewer",
            encryption_key=Fernet.generate_key().decode(), directory=tmp_path,
            now=NOW, collector_factory=UnexpectedCollector,
        )
