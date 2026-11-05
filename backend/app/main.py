from __future__ import annotations

import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager, suppress
from datetime import date, datetime, timezone
from decimal import Decimal
import json
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .account_lifecycle import router as account_router
from .db import get_db
from .metric_service import MetricValue, get_area_metrics
from .models import DataSource, PopulationMetric, RentBenchmark, SalesMetric, StoreMetric, SupportProgram, TradeArea
from .recommendations import percentile, recommend, select_diverse
from .reports import build_area_report
from .review_analysis import analyze_reviews, build_insights, sanitize_review_text
from .review_auth import get_review_user
from .review_capture import CaptureConfigurationError
from .review_report import append_audit, collect_or_load_area_review_report, collect_or_load_report, purge_expired_captures, purge_expired_reports, select_peer_places
from .review_industry import EXCLUSIONS, category_matches, category_terms, verified_kakao_place
from .trade_area_geometry import locate_area
from .support_programs import NormalizedProgram, SupportProfile, select_candidates
from .schemas import (
    AreaReportResponse,
    AreaReviewReportRequest,
    AreaReviewReportResponse,
    AreaInsightMetric,
    AreaInsightTimeSlot,
    AreaMapInsightResponse,
    ChecklistResponse,
    ComparisonMetric,
    ComparisonResponse,
    EvidenceArea,
    EvidenceResponse,
    IndustryOption,
    MetricAreaValue,
    RecommendationCandidate,
    RecommendationReason,
    RecommendationRequest,
    RecommendationResponse,
    RentBenchmarkResponse,
    RentMarketListResponse,
    ReviewAnalysisRequest,
    ReviewAnalysisResponse,
    ReviewAreaLocationResponse,
    ReviewAreaSummary,
    ReviewPeerSample,
    CapturedReviewReportRequest,
    CapturedReviewReportResponse,
    SupportProgramQuery,
    SupportProgramResponse,
    TradeAreaOut,
)


SUPPORTED_QUARTERS = {"20254": "2025년 4분기"}
INDUSTRY_CODE = "CS100010"
REVIEW_CAPTURE_DIR = Path(__file__).resolve().parents[2] / "database" / "raw" / "reviews"


def number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def data_status(session: Session, code: str, quarter: str = "20254", industry: str = INDUSTRY_CODE) -> dict[str, bool]:
    return {
        "store": session.get(StoreMetric, (quarter, code, industry)) is not None,
        "sales": session.get(SalesMetric, (quarter, code, industry)) is not None,
        "population": session.get(PopulationMetric, (quarter, code)) is not None,
    }


def industry_name(session: Session, industry_code: str, quarter: str) -> str | None:
    store = session.scalar(select(StoreMetric.industry_name).where(
        StoreMetric.quarter_code == quarter,
        StoreMetric.industry_code == industry_code,
    ).limit(1))
    sales = session.scalar(select(SalesMetric.industry_name).where(
        SalesMetric.quarter_code == quarter,
        SalesMetric.industry_code == industry_code,
    ).limit(1))
    return store or sales


def area_out(session: Session, area: TradeArea, status: dict[str, bool] | None = None, *, quarter: str = "20254", industry: str = INDUSTRY_CODE) -> TradeAreaOut:
    return TradeAreaOut(
        code=area.code,
        name=area.name,
        district_name=area.district_name,
        area_type_name=area.area_type_name,
        latitude=area.latitude,
        longitude=area.longitude,
        data_status=status if status is not None else data_status(session, area.code, quarter, industry),
    )


def validate_comparison(session: Session, codes_text: str, quarter: str) -> tuple[list[str], list[TradeArea]]:
    if quarter not in SUPPORTED_QUARTERS:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    codes = [code.strip() for code in codes_text.split(",") if code.strip()]
    if not 2 <= len(codes) <= 4:
        raise HTTPException(400, "비교할 상권은 2개 이상 4개 이하여야 합니다.")
    if len(set(codes)) != len(codes):
        raise HTTPException(400, "같은 상권을 중복해서 비교할 수 없습니다.")
    areas_by_code = {
        area.code: area
        for area in session.scalars(select(TradeArea).where(TradeArea.code.in_(codes))).all()
    }
    missing = [code for code in codes if code not in areas_by_code]
    if missing:
        raise HTTPException(404, f"상권을 찾을 수 없습니다: {', '.join(missing)}")
    return codes, [areas_by_code[code] for code in codes]


def comparison_id(quarter: str, codes: list[str], industry: str = INDUSTRY_CODE) -> str:
    prefix = quarter if industry == INDUSTRY_CODE else f"{quarter}~{industry}"
    return f"{prefix}--{'-'.join(codes)}"


def parse_comparison_id(value: str) -> tuple[str, str, str]:
    if "--" not in value:
        raise HTTPException(400, "잘못된 비교 ID입니다.")
    prefix, joined_codes = value.split("--", 1)
    quarter, industry = prefix.split("~", 1) if "~" in prefix else (prefix, INDUSTRY_CODE)
    return quarter, industry, joined_codes.replace("-", ",")


def build_comparison(session: Session, codes: list[str], areas: list[TradeArea], quarter: str, industry: str) -> ComparisonResponse:
    values_by_key: dict[str, list[MetricAreaValue]] = defaultdict(list)
    metadata: dict[str, MetricValue] = {}
    for code in codes:
        _, metrics = get_area_metrics(session, code, quarter, industry)
        for metric in metrics:
            metadata[metric.metric_key] = metric
            values_by_key[metric.metric_key].append(
                MetricAreaValue(
                    trade_area_code=code,
                    status=metric.status,
                    value=number(metric.value),
                    reason=metric.reason,
                )
            )
    return ComparisonResponse(
        comparison_id=comparison_id(quarter, codes, industry),
        quarter_code=quarter,
        quarter_label=SUPPORTED_QUARTERS[quarter],
        industry_code=industry,
        industry_name=industry_name(session, industry, quarter) or "선택 업종",
        trade_areas=[area_out(session, area, quarter=quarter, industry=industry) for area in areas],
        metrics=[
            ComparisonMetric(
                metric_key=key,
                label=metadata[key].label,
                unit=metadata[key].unit,
                values=values,
            )
            for key, values in values_by_key.items()
        ],
    )


settings = get_settings()


def _purge_expired_review_files() -> None:
    now = datetime.now(timezone.utc)
    removed = purge_expired_reports(REVIEW_CAPTURE_DIR, now) + purge_expired_captures(REVIEW_CAPTURE_DIR, now)
    if removed:
        append_audit(REVIEW_CAPTURE_DIR, event="purge", removed_count=removed, now=now)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _purge_expired_review_files()

    async def daily_cleanup() -> None:
        while True:
            await asyncio.sleep(24 * 60 * 60)
            _purge_expired_review_files()

    task = asyncio.create_task(daily_cleanup())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
app.include_router(account_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"]
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/review-capture-status")
def review_capture_status() -> dict[str, object]:
    """Expose capture metadata only; never return review text or source URLs."""
    captures = sorted(REVIEW_CAPTURE_DIR.glob("capture-*.json"), key=lambda path: path.stat().st_mtime)
    if not captures:
        return {"status": "not_collected", "review_count": 0, "provider_counts": {}}
    try:
        payload = json.loads(captures[-1].read_text(encoding="utf-8"))
        reviews = payload.get("reviews", [])
        provider_counts: dict[str, int] = defaultdict(int)
        for review in reviews:
            provider = review.get("provider")
            if provider in {"naver", "kakao"}:
                provider_counts[provider] += 1
        return {
            "status": "available",
            "captured_at": payload.get("captured_at"),
            "review_count": len(reviews),
            "provider_counts": dict(provider_counts),
        }
    except (OSError, ValueError, TypeError):
        return {"status": "unavailable", "review_count": 0, "provider_counts": {}}


@app.get("/api/v1/review-industry/{code}")
def review_industry_mapping(code: str, session: Session = Depends(get_db)) -> dict:
    name = industry_name(session, code, "20254")
    if name is None:
        raise HTTPException(404, "공식 점포 원천에서 업종을 찾을 수 없습니다.")
    terms = category_terms(code, name)
    return {
        "industry_code": code, "industry_name": name,
        "supported": bool(terms), "terms": terms,
        "excluded_terms": EXCLUSIONS.get(code, ()),
        "reason": None if terms else "이 업종과 카카오 장소 분류의 대응을 확인할 수 없어 리뷰 비교를 보류합니다.",
    }


@app.get("/api/v1/review-trade-area", response_model=ReviewAreaLocationResponse)
def review_trade_area(
    latitude: float = Query(ge=37.3, le=37.8),
    longitude: float = Query(ge=126.7, le=127.3),
    session: Session = Depends(get_db),
) -> ReviewAreaLocationResponse:
    try:
        location = locate_area(latitude, longitude)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(503, "공식 상권 경계 데이터를 확인할 수 없습니다.") from error
    area = session.get(TradeArea, location.code) if location.code else None
    return ReviewAreaLocationResponse(
        status=location.status if area else "unmapped",
        area=ReviewAreaSummary(
            code=area.code,
            name=area.name,
            district_name=area.district_name,
            area_type_name=area.area_type_name,
        ) if area else None,
        distance_m=location.distance_m,
    )


@app.post("/api/v1/captured-review-report", response_model=CapturedReviewReportResponse)
def captured_review_report(
    payload: CapturedReviewReportRequest,
    user_id: str = Depends(get_review_user),
    session: Session = Depends(get_db),
) -> CapturedReviewReportResponse:
    if not payload.ownership_confirmed:
        raise HTTPException(400, "내 가게 운영·관리 여부를 확인해 주세요.")
    selected_industry_name = industry_name(session, payload.industry_code, "20254")
    if selected_industry_name is None or not category_terms(payload.industry_code, selected_industry_name):
        raise HTTPException(400, "선택 업종과 카카오 장소 분류의 대응을 확인할 수 없습니다.")
    if not settings.kakao_rest_api_key:
        raise HTTPException(503, "카카오 장소 검증용 REST API 키가 설정되지 않았습니다.")
    try:
        verified_own = verified_kakao_place(payload.own, settings.kakao_rest_api_key)
        if not category_matches(payload.industry_code, selected_industry_name, verified_own.category or ""):
            raise ValueError("내 가게의 카카오 분류가 선택 업종과 다릅니다.")
        own_location = locate_area(verified_own.latitude, verified_own.longitude)
        selected_candidates = select_peer_places(
            verified_own, payload.candidates,
            own_location.code if own_location.status == "inside" else None,
        )
        verified_candidates = [verified_kakao_place(place, settings.kakao_rest_api_key) for place, _ in selected_candidates]
        if any(not category_matches(payload.industry_code, selected_industry_name, place.category or "") for place in verified_candidates):
            raise ValueError("주변 가게의 카카오 분류가 선택 업종과 다릅니다. 다시 검색해 주세요.")
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except Exception as error:
        raise HTTPException(503, "카카오 장소 재확인에 실패했습니다. 잠시 뒤 다시 시도해 주세요.") from error
    try:
        location = locate_area(verified_own.latitude, verified_own.longitude)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(503, "공식 상권 경계 데이터를 확인할 수 없습니다.") from error
    area = session.get(TradeArea, location.code) if location.code else None
    area_summary = ReviewAreaSummary(
        code=area.code, name=area.name,
        district_name=area.district_name, area_type_name=area.area_type_name,
    ) if area else None
    location_status = location.status if area or location.status == "unmapped" else "unmapped"
    peers = select_peer_places(verified_own, verified_candidates, area.code if location_status == "inside" and area else None)
    if len(peers) < 2:
        return CapturedReviewReportResponse(
            status="insufficient_sample", area=area_summary,
            location_status=location_status, area_distance_m=location.distance_m,
            own_review_count=0, peer_samples=[], total_review_count=0,
            eligible_place_count=0, required_place_count=3, required_review_count=30,
            topics=[], insights=[], failed_labels=[], captured_at=None, expires_at=None,
            from_cache=False, source="kakao",
            message=f"반경 1.2km 안에 같은 업종({selected_industry_name})의 주변 후보가 2곳 미만이라 리뷰 수집을 시작하지 않았습니다.",
            industry_code=payload.industry_code, industry_name=selected_industry_name,
        )
    try:
        return collect_or_load_report(
            own=verified_own,
            peers=peers,
            area=area_summary,
            location_status=location_status,
            area_distance_m=location.distance_m,
            user_id=user_id,
            encryption_key=settings.review_capture_encryption_key or "",
            industry_code=payload.industry_code,
            industry_name=selected_industry_name,
        )
    except CaptureConfigurationError as error:
        raise HTTPException(503, "리뷰 수집 저장 설정이 준비되지 않았습니다.") from error
    except RuntimeError as error:
        status = 429 if "횟수" in str(error) else 409
        raise HTTPException(status, str(error)) from error


@app.post("/api/v1/area-review-report", response_model=AreaReviewReportResponse)
def area_review_report(
    payload: AreaReviewReportRequest,
    user_id: str = Depends(get_review_user),
    session: Session = Depends(get_db),
) -> AreaReviewReportResponse:
    area = session.get(TradeArea, payload.trade_area_code)
    if area is None:
        raise HTTPException(404, "공식 상권을 찾을 수 없습니다.")
    selected_industry_name = industry_name(session, payload.industry_code, "20254")
    if selected_industry_name is None or not category_terms(payload.industry_code, selected_industry_name):
        raise HTTPException(400, "선택 업종과 카카오 장소 분류의 대응을 확인할 수 없습니다.")
    if not settings.kakao_rest_api_key:
        raise HTTPException(503, "카카오 장소 검증용 REST API 키가 설정되지 않았습니다.")
    summary = ReviewAreaSummary(code=area.code, name=area.name, district_name=area.district_name,
                                area_type_name=area.area_type_name)
    unique = {place.id: place for place in payload.candidates}
    nearby = sorted(unique.values(), key=lambda place: (
        (place.latitude - area.latitude) ** 2 + (place.longitude - area.longitude) ** 2, place.id,
    ))
    verified = []
    try:
        attempts = 0
        for place in nearby:
            if len(verified) >= 5:
                break
            location = locate_area(place.latitude, place.longitude)
            if location.status != "inside" or location.code != area.code:
                continue
            if attempts >= 12:
                break
            attempts += 1
            try:
                current = verified_kakao_place(place, settings.kakao_rest_api_key)
            except ValueError:
                continue
            location = locate_area(current.latitude, current.longitude)
            if location.status == "inside" and location.code == area.code and category_matches(
                payload.industry_code, selected_industry_name, current.category or "",
            ):
                verified.append(current)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(503, "공식 상권 경계 데이터를 확인할 수 없습니다.") from error
    except Exception as error:
        raise HTTPException(503, "카카오 장소 재확인에 실패했습니다. 잠시 뒤 다시 시도해 주세요.") from error
    if len(verified) < 3:
        return AreaReviewReportResponse(
            status="insufficient_sample", area=summary, industry_code=payload.industry_code,
            industry_name=selected_industry_name,
            place_samples=[ReviewPeerSample(label=label, review_count=0, same_trade_area=True)
                           for label, _ in zip("ABCDE", verified)],
            total_review_count=0, analyzed_review_count=0, eligible_place_count=0,
            required_place_count=3, required_review_count=30, topics=[], failed_labels=[],
            captured_at=None, expires_at=None, from_cache=False, source="kakao",
            message=f"{area.name} 안에서 분류가 확인된 {selected_industry_name} 가게가 3곳 미만이라 수집하지 않았습니다.",
        )
    try:
        return collect_or_load_area_review_report(
            area=summary, industry_code=payload.industry_code, industry_name=selected_industry_name,
            places=verified, user_id=user_id, encryption_key=settings.review_capture_encryption_key or "",
        )
    except CaptureConfigurationError as error:
        raise HTTPException(503, "리뷰 수집 저장 설정이 준비되지 않았습니다.") from error
    except RuntimeError as error:
        status = 429 if "횟수" in str(error) else 409
        raise HTTPException(status, str(error)) from error


@app.get("/api/v1/trade-areas", response_model=list[TradeAreaOut])
def list_trade_areas(
    district: str | None = Query(default=None),
    industry: str = Query(default=INDUSTRY_CODE),
    session: Session = Depends(get_db),
) -> list[TradeAreaOut]:
    if industry_name(session, industry, "20254") is None:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    query = select(TradeArea).order_by(TradeArea.district_name, TradeArea.name)
    if district:
        query = query.where(TradeArea.district_name == district)
    areas = session.scalars(query).all()
    codes = {area.code for area in areas}
    store_codes = set(session.scalars(select(StoreMetric.trade_area_code).where(
        StoreMetric.quarter_code == "20254",
        StoreMetric.industry_code == industry,
        StoreMetric.trade_area_code.in_(codes),
    )).all())
    sales_codes = set(session.scalars(select(SalesMetric.trade_area_code).where(
        SalesMetric.quarter_code == "20254",
        SalesMetric.industry_code == industry,
        SalesMetric.trade_area_code.in_(codes),
    )).all())
    population_codes = set(session.scalars(select(PopulationMetric.trade_area_code).where(
        PopulationMetric.quarter_code == "20254",
        PopulationMetric.trade_area_code.in_(codes),
    )).all())
    return [area_out(session, area, {
        "store": area.code in store_codes,
        "sales": area.code in sales_codes,
        "population": area.code in population_codes,
    }) for area in areas]


@app.get("/api/v1/industries", response_model=list[IndustryOption])
def list_industries(
    quarter: str = Query(default="20254"),
    session: Session = Depends(get_db),
) -> list[IndustryOption]:
    if quarter not in SUPPORTED_QUARTERS:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    rows = session.execute(
        select(StoreMetric.industry_code, StoreMetric.industry_name, func.count(StoreMetric.trade_area_code))
        .where(StoreMetric.quarter_code == quarter)
        .group_by(StoreMetric.industry_code, StoreMetric.industry_name)
        .order_by(StoreMetric.industry_name)
    ).all()
    sales_counts = dict(session.execute(
        select(SalesMetric.industry_code, func.count(SalesMetric.trade_area_code))
        .where(SalesMetric.quarter_code == quarter)
        .group_by(SalesMetric.industry_code)
    ).all())
    return [IndustryOption(
        code=code, name=name, store_area_count=store_count,
        sales_area_count=sales_counts.get(code, 0), has_sales_source=code in sales_counts,
    ) for code, name, store_count in rows]


@app.get("/api/v1/trade-areas/{code}", response_model=TradeAreaOut)
def get_trade_area(code: str, industry: str = Query(default=INDUSTRY_CODE), session: Session = Depends(get_db)) -> TradeAreaOut:
    area = session.get(TradeArea, code)
    if not area:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    if industry_name(session, industry, "20254") is None:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    return area_out(session, area, industry=industry)


@app.get("/api/v1/trade-areas/{code}/map-insight", response_model=AreaMapInsightResponse)
def get_trade_area_map_insight(
    code: str,
    quarter: str = Query(default="20254"),
    industry: str = Query(default=INDUSTRY_CODE),
    session: Session = Depends(get_db),
) -> AreaMapInsightResponse:
    """Return only the official, trade-area-level metrics usable beside the map."""
    if quarter not in SUPPORTED_QUARTERS:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    selected_industry_name = industry_name(session, industry, quarter)
    if not selected_industry_name:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    area, metrics = get_area_metrics(session, code, quarter, industry)
    if not area:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")

    metric_by_key = {metric.metric_key: metric for metric in metrics}

    peer_areas = session.scalars(
        select(TradeArea).join(StoreMetric, StoreMetric.trade_area_code == TradeArea.code).where(
            TradeArea.district_name == area.district_name,
            StoreMetric.quarter_code == quarter,
            StoreMetric.industry_code == industry,
        )
    ).all()
    peer_metrics = [
        {metric.metric_key: metric for metric in get_area_metrics(session, peer.code, quarter, industry)[1]}
        for peer in peer_areas
    ]

    def metric_out(key: str) -> AreaInsightMetric:
        metric = metric_by_key[key]
        values = [float(items[key].value) for items in peer_metrics if items[key].status == "available" and items[key].value is not None]
        return AreaInsightMetric(
            metric_key=key,
            label=metric.label,
            unit=metric.unit,
            status=metric.status,
            value=number(metric.value),
            reason=metric.reason,
            percentile=percentile(float(metric.value), values) if metric.status == "available" and metric.value is not None and values else None,
        )

    population = session.get(PopulationMetric, (quarter, code))
    slot_labels = {
        "00_06": "00~06시",
        "06_11": "06~11시",
        "11_14": "11~14시",
        "14_17": "14~17시",
        "17_21": "17~21시",
        "21_24": "21~24시",
    }
    time_slots = []
    for key, label in slot_labels.items():
        value = getattr(population, f"population_{key}") if population else None
        ratio_metric = metric_by_key[f"population_{key}_ratio"]
        time_slots.append(AreaInsightTimeSlot(
            metric_key=f"population_{key}",
            label=label,
            unit="명",
            status="available" if value is not None else "unavailable",
            value=float(value) if value is not None else None,
            reason=None if value is not None else "해당 분기의 유동인구 원천 행이 없습니다.",
            ratio=number(ratio_metric.value),
        ))

    return AreaMapInsightResponse(
        quarter_code=quarter,
        quarter_label=SUPPORTED_QUARTERS[quarter],
        trade_area=area_out(session, area, quarter=quarter, industry=industry),
        total_population=metric_out("total_population"),
        sales_amount=metric_out("sales_amount"),
        weekday_sales_ratio=metric_out("weekday_sales_ratio"),
        weekend_sales_ratio=metric_out("weekend_sales_ratio"),
        time_slots=time_slots,
        population_source="서울시 우리마을가게 상권분석서비스 유동인구",
        sales_source=f"서울시 우리마을가게 상권분석서비스 {selected_industry_name} 매출",
        comparison_group_label=f"같은 자치구의 {selected_industry_name} 통계 보유 공식 상권",
        comparison_group_count=len(peer_areas),
        notice="상대 위치는 같은 자치구의 공식 상권 통계 보유 행과 비교한 값입니다. 임의 반경의 주변 상권, 성공 가능성 또는 창업 추천을 뜻하지 않습니다. 거리별 유동량·연령대별 유동인구·개별 매물 정보는 이 데이터에 포함되지 않습니다.",
    )


@app.get("/api/v1/trade-areas/{code}/report", response_model=AreaReportResponse)
def get_trade_area_report(
    code: str,
    quarter: str = Query(default="20254"),
    industry: str = Query(default=INDUSTRY_CODE),
    session: Session = Depends(get_db),
) -> AreaReportResponse:
    if quarter not in SUPPORTED_QUARTERS:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    selected_industry_name = industry_name(session, industry, quarter)
    if not selected_industry_name:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    report = build_area_report(session, code, quarter, industry)
    if not report:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    return AreaReportResponse(
        quarter_code=quarter,
        quarter_label=SUPPORTED_QUARTERS[quarter],
        industry_code=industry,
        industry_name=selected_industry_name,
        comparison_count=report["comparison_count"],
        trade_area=area_out(session, report["area"], quarter=quarter, industry=industry),
        strengths=report["strengths"],
        cautions=report["cautions"],
        characteristics=report["characteristics"],
        notice="상·하위 30%는 상대 위치이며 창업 성과나 인과관계를 의미하지 않습니다.",
    )


@app.get("/api/v1/rent-markets", response_model=RentMarketListResponse)
def get_rent_markets(session: Session = Depends(get_db)) -> RentMarketListResponse:
    rows = session.scalars(
        select(RentBenchmark)
        .where(
            RentBenchmark.metric_key == "rent_per_sqm",
            RentBenchmark.region_code.like("52%"),
            RentBenchmark.region_name.like("서울>%"),
        )
        .order_by(RentBenchmark.region_name)
    ).all()
    return RentMarketListResponse(
        provider="한국부동산원",
        dataset_name="상업용부동산 임대동향조사",
        markets=[
            {
                "region_code": row.region_code,
                "name": row.region_name.split(">")[-1],
                "group": row.region_name.split(">")[1] if row.region_name.count(">") >= 2 else "서울",
                "source_period": row.period_label,
            }
            for row in rows
        ],
        notice="R-ONE 조사상권과 서울시 골목상권은 경계가 다르므로 가까운 조사상권을 사용자가 직접 확인해 선택합니다.",
    )


@app.get("/api/v1/trade-areas/{code}/rent-benchmark", response_model=RentBenchmarkResponse)
def get_rent_benchmark(
    code: str,
    market_code: str | None = Query(default=None),
    session: Session = Depends(get_db),
) -> RentBenchmarkResponse:
    area = session.get(TradeArea, code)
    if not area:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    seoul_benchmarks = session.scalars(
        select(RentBenchmark)
        .where(RentBenchmark.region_code == "500002")
        .order_by(RentBenchmark.metric_key)
    ).all()
    selected_code = market_code or "500002"
    benchmarks = session.scalars(
        select(RentBenchmark)
        .where(RentBenchmark.region_code == selected_code)
        .order_by(RentBenchmark.metric_key)
    ).all()
    common = {
        "trade_area": area_out(session, area),
        "provider": "한국부동산원",
        "dataset_name": "상업용부동산 임대동향조사",
        "update_cycle": "분기",
        "is_live_listing": False,
        "source_url": "https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284",
        "api_docs_url": "https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do",
        "disclaimer": "표본조사 기반 시장 참고값이며 개별 매물의 호가·계약조건이나 선택한 서울시 상권의 고유값이 아닙니다.",
    }
    if not seoul_benchmarks:
        return RentBenchmarkResponse(
            status="mapping_required",
            message="R-ONE 원천 통계가 아직 적재되지 않았습니다. 서울시 상권 값으로 추정하거나 0으로 대체하지 않습니다.",
            **common,
        )
    if market_code and (not market_code.startswith("52") or not benchmarks):
        raise HTTPException(404, "선택한 R-ONE 조사상권 통계를 찾을 수 없습니다.")

    periods = sorted({item.period_label for item in benchmarks})
    is_detailed_market = bool(market_code)
    selected_region = benchmarks[0].region_name if is_detailed_market and benchmarks else "서울 전체"
    metric_dicts = [
        {
            "metric_key": item.metric_key,
            "label": item.metric_label,
            "value": item.value,
            "unit": item.unit,
            "table_id": item.table_id,
            "item_id": item.item_id,
        }
        for item in benchmarks
    ]
    seoul_metric_dicts = [
        {
            "metric_key": item.metric_key,
            "label": item.metric_label,
            "value": item.value,
            "unit": item.unit,
            "table_id": item.table_id,
            "item_id": item.item_id,
        }
        for item in seoul_benchmarks
    ]
    return RentBenchmarkResponse(
        status="available",
        source_period=", ".join(periods),
        source_region=selected_region.replace(">", " · "),
        building_type="소규모상가",
        mapping_scope="official_market_statistic" if is_detailed_market else "administrative_context",
        confidence="contextual",
        selected_market_code=selected_code,
        metrics=metric_dicts,
        seoul_metrics=seoul_metric_dicts,
        message=(
            "선택한 R-ONE 조사상권의 공식 표본통계입니다. 서울시 골목상권과 경계가 다르므로 같은 지역인지 지도와 현장에서 다시 확인해야 합니다."
            if is_detailed_market
            else "서울 전체 소규모상가의 공식 분기 평균입니다. 아래에서 가까운 R-ONE 조사상권을 선택하면 더 세부적인 참고값을 볼 수 있습니다."
        ),
        **common,
    )


@app.post("/api/v1/support-programs", response_model=SupportProgramResponse)
def support_programs(profile: SupportProgramQuery, db: Session = Depends(get_db)) -> SupportProgramResponse:
    # profile is deliberately limited to non-sensitive eligibility hints. Credit,
    # debt and approval predictions are outside the product scope.
    stored = list(db.scalars(select(SupportProgram)).all())
    if not stored:
        key_missing = not settings.k_startup_api_key
        return SupportProgramResponse(
            status="configuration_required",
            provider="창업진흥원 K-Startup",
            checked_at=date.today().isoformat(),
            message=(
                "현재 모집 공고를 확인하려면 공공데이터포털에서 K-Startup Open API 활용신청과 인증키 발급이 필요합니다. 키가 없으므로 오래된 공고나 가상 상품을 후보로 표시하지 않습니다."
                if key_missing
                else "인증키는 확인됐지만 수집·적재된 운영 공고가 없습니다. 수집 파이프라인을 실행하기 전에는 가상 상품을 표시하지 않습니다."
            ),
            required_setting="K_STARTUP_API_KEY" if key_missing else None,
            candidates=[],
            source_url="https://www.k-startup.go.kr/",
            disclaimer="지원 자격이나 선정 가능성을 보장하지 않습니다. 신청 전 공고 원문과 수행기관 안내를 확인하세요.",
        )

    programs = [NormalizedProgram(
        program_id=item.program_id,
        title=item.title,
        application_start=item.application_start,
        application_end=item.application_end,
        regions=tuple(item.regions),
        stages=tuple(item.stages),
        minimum_age=item.minimum_age,
        maximum_age=item.maximum_age,
        maximum_years_in_business=item.maximum_years_in_business,
        source_url=item.source_url,
        support_type=item.support_type,
        target_text=item.target_text,
        region_text=item.region_text,
        business_age_text=item.business_age_text,
        age_text=item.age_text,
        unparsed_conditions=tuple(item.unparsed_conditions),
    ) for item in stored]
    candidates = select_candidates(
        programs,
        SupportProfile(
            stage=profile.stage,
            region=profile.region,
            age=profile.age,
            years_in_business=profile.years_in_business,
        ),
        today=date.today(),
        limit=2,
    )
    return SupportProgramResponse(
        status="available" if candidates else "no_candidates",
        provider="창업진흥원 K-Startup",
        checked_at=date.today().isoformat(),
        message=(
            f"현재 모집 공고 중 입력 조건과 명백히 충돌하지 않는 후보 {len(candidates)}건입니다."
            if candidates
            else "현재 모집 공고 중 입력 조건과 명백히 충돌하지 않는 후보가 없습니다."
        ),
        required_setting=None,
        candidates=[{
            "program_id": program.program_id,
            "title": program.title,
            "application_start": program.application_start.isoformat(),
            "application_end": program.application_end.isoformat(),
            "regions": list(program.regions),
            "support_type": program.support_type or "공고 원문 확인",
            "target": program.target_text or "공고 원문 확인",
            "source_url": program.source_url,
            "reasons": [check.explanation for check in checks if check.state == "matched"],
            "needs_confirmation": [check.explanation for check in checks if check.state == "needs_confirmation"],
        } for program, checks in candidates],
        source_url="https://www.k-startup.go.kr/",
        disclaimer="지원 자격이나 선정 가능성을 보장하지 않습니다. 신청 전 공고 원문과 수행기관 안내를 확인하세요.",
    )


@app.post("/api/v1/review-analysis", response_model=ReviewAnalysisResponse)
def review_analysis(payload: ReviewAnalysisRequest) -> ReviewAnalysisResponse:
    if not payload.ownership_confirmed or not payload.data_rights_confirmed:
        raise HTTPException(400, "가게 관리 권한과 리뷰 데이터 사용 권한을 모두 확인해야 합니다.")
    if any(len(item) > 2000 for item in payload.own_reviews + payload.nearby_reviews):
        raise HTTPException(400, "리뷰 한 건은 최대 2,000자까지 분석할 수 있습니다.")
    own_reviews = [sanitize_review_text(item) for item in payload.own_reviews if item.strip()]
    nearby_reviews = [sanitize_review_text(item) for item in payload.nearby_reviews if item.strip()]
    if len(own_reviews) > 500 or len(nearby_reviews) > 500:
        raise HTTPException(400, "한 그룹당 리뷰는 최대 500개까지 분석할 수 있습니다.")
    own = analyze_reviews(own_reviews)
    nearby = analyze_reviews(nearby_reviews)

    def side(stats):
        return {
            "mentions": stats.mentions,
            "positive": stats.positive,
            "negative": stats.negative,
            "neutral": stats.neutral,
            "evidence": [item.__dict__ for item in stats.evidence],
        }

    enough = len(own_reviews) >= 5 and len(nearby_reviews) >= 5
    return ReviewAnalysisResponse(
        status="available" if enough else "insufficient_sample",
        source="user_provided",
        own_shop_name=payload.own_shop_name.strip() or "내 가게",
        comparison_scope=payload.comparison_scope.strip() or "사용자 선택 주변 동종 가게",
        period_label=payload.period_label.strip() or "기간 미입력",
        own_sample_count=len(own_reviews),
        nearby_sample_count=len(nearby_reviews),
        topics=[{
            "topic_key": key,
            "label": own[key].label,
            "own": side(own[key]),
            "nearby": side(nearby[key]),
        } for key in own],
        insights=build_insights(own, nearby) if enough else [],
        notice=(
            "사용자가 권한을 확인해 제공한 리뷰의 키워드 기반 요약입니다. 연락처·이메일·링크·계정명은 분석 전에 제거하며, 개인을 식별하거나 성과를 보장하지 않습니다."
            if enough
            else "각 그룹 5개 이상이 필요합니다. 표본이 부족해 실행 아이디어를 만들지 않고 비식별 집계만 제공합니다."
        ),
    )


@app.post("/api/v1/recommendations", response_model=RecommendationResponse)
def recommend_trade_areas(
    profile: RecommendationRequest,
    session: Session = Depends(get_db),
) -> RecommendationResponse:
    selected_industry_name = industry_name(session, profile.industry_code, "20254")
    if selected_industry_name is None:
        return RecommendationResponse(
            status="unsupported_business",
            message="선택한 업종의 점포 원천이 없어 후보 상권을 계산할 수 없습니다.",
            quarter_code="20254",
            quarter_label=SUPPORTED_QUARTERS["20254"],
            industry_code=profile.industry_code,
            industry_name="선택 업종",
            weights_version="industry-v1",
            candidate_pool_size=0,
            diversity_rule="적용 안 함",
            candidates=[],
        )

    scored = recommend(
        session,
        demand=profile.demand,
        risk=profile.risk,
        competition=profile.competition,
        industry=profile.industry_code,
    )
    if not scored:
        return RecommendationResponse(
            status="unsupported_business",
            message="이 업종에서 같은 지표로 비교할 수 있는 상권이 3곳 미만입니다. 상권 탐색에서 원천 보유 상태를 확인해 주세요.",
            quarter_code="20254", quarter_label=SUPPORTED_QUARTERS["20254"],
            industry_code=profile.industry_code, industry_name=selected_industry_name,
            weights_version="industry-v1", candidate_pool_size=0,
            diversity_rule="적용 안 함", candidates=[],
        )
    selected = select_diverse(scored, 3)
    candidates = []
    for rank, candidate in enumerate(selected, start=1):
        strongest = sorted(candidate.components, key=lambda item: item["fit_percentile"] * item["weight"], reverse=True)[:3]
        weakest = sorted(candidate.components, key=lambda item: item["fit_percentile"])[:2]
        reasons = []
        for component in strongest:
            if component["direction"] == "higher":
                explanation = f"{component['label']}: 비교 가능한 {selected_industry_name} 상권 중 {component['percentile']} 백분위입니다."
            else:
                explanation = f"{component['label']}: 비교군에서 낮을수록 선호 조건과 맞으며 현재 {component['percentile']} 백분위입니다."
            reasons.append(RecommendationReason(**component, explanation=explanation))
        cautions = [
            (
                f"{item['label']}: 비교 상권보다 높은 편이라 선택한 조건과 거리가 있어요."
                if item["direction"] == "lower"
                else f"{item['label']}: 선택한 조건과 비교하면 낮은 편이라 현장에서 확인해 보세요."
            )
            for item in weakest
        ]
        candidates.append(RecommendationCandidate(
            rank=rank,
            score=candidate.score,
            trade_area=area_out(session, candidate.area, industry=profile.industry_code),
            reasons=reasons,
            cautions=cautions,
            data_completeness=f"{candidate.available_count}/14",
        ))
    return RecommendationResponse(
        status="available",
        message="성공을 예측한 결과가 아니에요. 내가 고른 답과 현재 확인할 수 있는 숫자를 바탕으로 먼저 살펴볼 순서를 정했어요.",
        quarter_code="20254",
        quarter_label=SUPPORTED_QUARTERS["20254"],
        industry_code=profile.industry_code,
        industry_name=selected_industry_name,
        weights_version="industry-v1",
        candidate_pool_size=len(scored),
        diversity_rule="기본 적합도에 다른 자치구 +2점, 다른 상권 유형 +1점의 선택 보너스를 적용합니다.",
        candidates=candidates,
    )


@app.get("/api/v1/comparisons", response_model=ComparisonResponse)
def compare_trade_areas(
    codes: str = Query(..., description="쉼표로 구분한 상권 코드 2~4개"),
    quarter: str = Query(default="20254"),
    industry: str = Query(default=INDUSTRY_CODE),
    session: Session = Depends(get_db),
) -> ComparisonResponse:
    code_list, areas = validate_comparison(session, codes, quarter)
    if industry_name(session, industry, quarter) is None:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    return build_comparison(session, code_list, areas, quarter, industry)


SOURCE_BY_METRIC = {
    "store_count": "store",
    "opening_rate": "store",
    "closing_rate": "store",
    "sales_amount": "sales",
    "weekday_sales_ratio": "sales",
    "weekend_sales_ratio": "sales",
    "average_payment": "sales",
    "total_population": "population",
}


@app.get(
    "/api/v1/comparisons/{comparison_id_value}/evidence/{metric_key}",
    response_model=EvidenceResponse,
)
def get_evidence(
    comparison_id_value: str,
    metric_key: str,
    session: Session = Depends(get_db),
) -> EvidenceResponse:
    quarter, industry, codes_text = parse_comparison_id(comparison_id_value)
    codes, areas = validate_comparison(session, codes_text, quarter)
    selected_industry_name = industry_name(session, industry, quarter)
    if not selected_industry_name:
        raise HTTPException(400, "해당 업종의 검증된 통계가 없습니다.")
    area_map = {area.code: area for area in areas}
    selected_metrics: list[tuple[str, MetricValue]] = []
    for code in codes:
        _, metrics = get_area_metrics(session, code, quarter, industry)
        metric = next((item for item in metrics if item.metric_key == metric_key), None)
        if not metric:
            raise HTTPException(404, "지표를 찾을 수 없습니다.")
        selected_metrics.append((code, metric))

    source_key = SOURCE_BY_METRIC.get(metric_key)
    if metric_key.startswith("population_"):
        source_key = "population"
    if not source_key:
        raise HTTPException(404, "지표 출처를 찾을 수 없습니다.")
    source = session.get(DataSource, source_key)
    if not source:
        raise HTTPException(500, "데이터 출처 정보가 없습니다.")

    first = selected_metrics[0][1]
    formula = first.calculation.formula if first.calculation else None
    rounding = "소수 첫째 자리, ROUND_HALF_UP" if first.unit == "%" and formula else None
    if metric_key == "average_payment":
        rounding = "원 단위, ROUND_HALF_UP"
    return EvidenceResponse(
        metric_key=metric_key,
        label=first.label,
        unit=first.unit,
        dataset_name=source.dataset_name,
        provider=source.provider,
        source_file=source.source_file,
        fetched_at=source.fetched_at.isoformat() if source.fetched_at else None,
        quarter_code=quarter,
        industry_code=industry,
        industry_name=selected_industry_name,
        formula=formula,
        rounding=rounding,
        areas=[
            EvidenceArea(
                trade_area_code=code,
                trade_area_name=area_map[code].name,
                status=metric.status,
                value=number(metric.value),
                reason=metric.reason,
                filter={
                    "quarter_code": quarter,
                    "trade_area_code": code,
                    "industry_code": industry if source_key in {"store", "sales"} else "해당 없음",
                },
                numerator=metric.calculation.numerator if metric.calculation else None,
                denominator=metric.calculation.denominator if metric.calculation else None,
            )
            for code, metric in selected_metrics
        ],
    )


@app.get("/api/v1/field-checklist", response_model=ChecklistResponse)
def field_checklist() -> ChecklistResponse:
    return ChecklistResponse(
        notice="공공데이터는 추정 통계입니다. 현장에서 직접 확인한 내용과 함께 판단하세요.",
        items=[
            {"category": "유동", "question": "표시된 유동인구와 선택 업종의 실제 고객 동선이 얼마나 겹치나요?"},
            {"category": "시간대", "question": "유동인구가 많은 시간에 주변 동종 가게의 이용 상황은 어떤가요?"},
            {"category": "경쟁", "question": "비슷한 가격대와 서비스를 제공하는 가게가 몇 곳인가요?"},
            {"category": "입지", "question": "매장 후보가 보행자의 시야에서 잘 보이고 접근하기 쉬운가요?"},
            {"category": "비용", "question": "임대료·관리비·권리금과 공실 기간을 중개사에게 확인했나요?"},
        ],
    )

