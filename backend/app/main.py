from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .metric_service import MetricValue, get_area_metrics
from .models import DataSource, PopulationMetric, RentBenchmark, SalesMetric, StoreMetric, SupportProgram, TradeArea
from .recommendations import recommend, select_diverse
from .reports import build_area_report
from .review_analysis import analyze_reviews, build_insights
from .support_programs import NormalizedProgram, SupportProfile, select_candidates
from .schemas import (
    AreaReportResponse,
    ChecklistResponse,
    ComparisonMetric,
    ComparisonResponse,
    EvidenceArea,
    EvidenceResponse,
    MetricAreaValue,
    RecommendationCandidate,
    RecommendationReason,
    RecommendationRequest,
    RecommendationResponse,
    RentBenchmarkResponse,
    ReviewAnalysisRequest,
    ReviewAnalysisResponse,
    SupportProgramQuery,
    SupportProgramResponse,
    TradeAreaOut,
)


SUPPORTED_QUARTERS = {"20254": "2025년 4분기"}
INDUSTRY_CODE = "CS100010"


def number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


def data_status(session: Session, code: str, quarter: str = "20254") -> dict[str, bool]:
    return {
        "store": session.get(StoreMetric, (quarter, code, INDUSTRY_CODE)) is not None,
        "sales": session.get(SalesMetric, (quarter, code, INDUSTRY_CODE)) is not None,
        "population": session.get(PopulationMetric, (quarter, code)) is not None,
    }


def area_out(session: Session, area: TradeArea) -> TradeAreaOut:
    return TradeAreaOut(
        code=area.code,
        name=area.name,
        district_name=area.district_name,
        area_type_name=area.area_type_name,
        latitude=area.latitude,
        longitude=area.longitude,
        data_status=data_status(session, area.code),
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


def comparison_id(quarter: str, codes: list[str]) -> str:
    return f"{quarter}--{'-'.join(codes)}"


def parse_comparison_id(value: str) -> tuple[str, str]:
    if "--" not in value:
        raise HTTPException(400, "잘못된 비교 ID입니다.")
    quarter, joined_codes = value.split("--", 1)
    return quarter, joined_codes.replace("-", ",")


def build_comparison(session: Session, codes: list[str], areas: list[TradeArea], quarter: str) -> ComparisonResponse:
    values_by_key: dict[str, list[MetricAreaValue]] = defaultdict(list)
    metadata: dict[str, MetricValue] = {}
    for code in codes:
        _, metrics = get_area_metrics(session, code, quarter, INDUSTRY_CODE)
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
        comparison_id=comparison_id(quarter, codes),
        quarter_code=quarter,
        quarter_label=SUPPORTED_QUARTERS[quarter],
        trade_areas=[area_out(session, area) for area in areas],
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
app = FastAPI(title=settings.app_name, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/trade-areas", response_model=list[TradeAreaOut])
def list_trade_areas(
    district: str | None = Query(default=None),
    session: Session = Depends(get_db),
) -> list[TradeAreaOut]:
    query = select(TradeArea).order_by(TradeArea.district_name, TradeArea.name)
    if district:
        query = query.where(TradeArea.district_name == district)
    return [area_out(session, area) for area in session.scalars(query).all()]


@app.get("/api/v1/trade-areas/{code}", response_model=TradeAreaOut)
def get_trade_area(code: str, session: Session = Depends(get_db)) -> TradeAreaOut:
    area = session.get(TradeArea, code)
    if not area:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    return area_out(session, area)


@app.get("/api/v1/trade-areas/{code}/report", response_model=AreaReportResponse)
def get_trade_area_report(
    code: str,
    quarter: str = Query(default="20254"),
    session: Session = Depends(get_db),
) -> AreaReportResponse:
    if quarter not in SUPPORTED_QUARTERS:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    report = build_area_report(session, code, quarter)
    if not report:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    return AreaReportResponse(
        quarter_code=quarter,
        quarter_label=SUPPORTED_QUARTERS[quarter],
        comparison_count=report["comparison_count"],
        trade_area=area_out(session, report["area"]),
        strengths=report["strengths"],
        cautions=report["cautions"],
        characteristics=report["characteristics"],
        notice="상·하위 30%는 상대 위치이며 창업 성과나 인과관계를 의미하지 않습니다.",
    )


@app.get("/api/v1/trade-areas/{code}/rent-benchmark", response_model=RentBenchmarkResponse)
def get_rent_benchmark(code: str, session: Session = Depends(get_db)) -> RentBenchmarkResponse:
    area = session.get(TradeArea, code)
    if not area:
        raise HTTPException(404, "상권을 찾을 수 없습니다.")
    benchmarks = session.scalars(
        select(RentBenchmark)
        .where(RentBenchmark.region_code == "500002")
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
    if not benchmarks:
        return RentBenchmarkResponse(
            status="mapping_required",
            message="R-ONE 원천 통계가 아직 적재되지 않았습니다. 서울시 상권 값으로 추정하거나 0으로 대체하지 않습니다.",
            **common,
        )
    periods = sorted({item.period_label for item in benchmarks})
    return RentBenchmarkResponse(
        status="available",
        source_period=", ".join(periods),
        source_region="서울 전체",
        building_type="소규모상가",
        mapping_scope="administrative_context",
        confidence="contextual",
        metrics=[
            {
                "metric_key": item.metric_key,
                "label": item.metric_label,
                "value": item.value,
                "unit": item.unit,
                "table_id": item.table_id,
                "item_id": item.item_id,
            }
            for item in benchmarks
        ],
        message="선택한 상권의 정확한 임대료가 아니라 서울 전체 소규모상가의 공식 분기 참고값입니다. R-ONE 조사상권과 서울시 상권 경계는 서로 다릅니다.",
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
    own_reviews = [item.strip() for item in payload.own_reviews if item.strip()]
    nearby_reviews = [item.strip() for item in payload.nearby_reviews if item.strip()]
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
            "사용자가 제공한 리뷰의 키워드 기반 요약입니다. 관찰과 실행 아이디어를 구분해 보며 개인을 식별하거나 성과를 보장하지 않습니다."
            if enough
            else "각 그룹 5개 이상이 필요합니다. 표본이 부족해 실행 아이디어를 만들지 않았습니다."
        ),
    )


@app.post("/api/v1/recommendations", response_model=RecommendationResponse)
def recommend_trade_areas(
    profile: RecommendationRequest,
    session: Session = Depends(get_db),
) -> RecommendationResponse:
    if profile.business != "cafe":
        return RecommendationResponse(
            status="unsupported_business",
            message="현재는 검증된 카페·디저트 데이터만 후보 상권을 제공합니다.",
            quarter_code="20254",
            quarter_label=SUPPORTED_QUARTERS["20254"],
            weights_version="cafe-v1",
            candidate_pool_size=0,
            diversity_rule="적용 안 함",
            candidates=[],
        )

    scored = recommend(
        session,
        demand=profile.demand,
        risk=profile.risk,
        competition=profile.competition,
    )
    selected = select_diverse(scored, 3)
    candidates = []
    for rank, candidate in enumerate(selected, start=1):
        strongest = sorted(candidate.components, key=lambda item: item["fit_percentile"] * item["weight"], reverse=True)[:3]
        weakest = sorted(candidate.components, key=lambda item: item["fit_percentile"])[:2]
        reasons = []
        for component in strongest:
            if component["direction"] == "higher":
                explanation = f"{component['label']}이 비교 가능한 카페 상권 중 {component['percentile']} 백분위입니다."
            else:
                explanation = f"{component['label']}이 비교군에서 낮을수록 선호 조건과 맞으며 현재 {component['percentile']} 백분위입니다."
            reasons.append(RecommendationReason(**component, explanation=explanation))
        cautions = [
            (
                f"{item['label']}이 비교군에서 높아 낮은 값 선호와 거리가 있습니다."
                if item["direction"] == "lower"
                else f"{item['label']}이 선호 조건 기준으로 상대적으로 낮아 현장 확인이 필요합니다."
            )
            for item in weakest
        ]
        candidates.append(RecommendationCandidate(
            rank=rank,
            score=candidate.score,
            trade_area=area_out(session, candidate.area),
            reasons=reasons,
            cautions=cautions,
            data_completeness="14/14",
        ))
    return RecommendationResponse(
        status="available",
        message="성공 예측이 아닌, 응답 조건과 검증된 지표가 잘 맞는 탐색 후보입니다.",
        quarter_code="20254",
        quarter_label=SUPPORTED_QUARTERS["20254"],
        weights_version="cafe-v1",
        candidate_pool_size=len(scored),
        diversity_rule="기본 적합도에 다른 자치구 +2점, 다른 상권 유형 +1점의 선택 보너스를 적용합니다.",
        candidates=candidates,
    )


@app.get("/api/v1/comparisons", response_model=ComparisonResponse)
def compare_trade_areas(
    codes: str = Query(..., description="쉼표로 구분한 상권 코드 2~4개"),
    quarter: str = Query(default="20254"),
    session: Session = Depends(get_db),
) -> ComparisonResponse:
    code_list, areas = validate_comparison(session, codes, quarter)
    return build_comparison(session, code_list, areas, quarter)


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
    quarter, codes_text = parse_comparison_id(comparison_id_value)
    codes, areas = validate_comparison(session, codes_text, quarter)
    area_map = {area.code: area for area in areas}
    selected_metrics: list[tuple[str, MetricValue]] = []
    for code in codes:
        _, metrics = get_area_metrics(session, code, quarter, INDUSTRY_CODE)
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
                    "industry_code": INDUSTRY_CODE if source_key in {"store", "sales"} else "해당 없음",
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
            {"category": "유동", "question": "표시된 유동인구가 실제 카페 고객이 될 만한 동선에 있나요?"},
            {"category": "시간대", "question": "유동인구가 많은 시간에 주변 카페 좌석과 대기 상황은 어떤가요?"},
            {"category": "경쟁", "question": "비슷한 가격대와 콘셉트의 카페가 몇 곳 있으며 손님은 얼마나 머무나요?"},
            {"category": "입지", "question": "매장 후보가 보행자의 시야에서 잘 보이고 접근하기 쉬운가요?"},
            {"category": "비용", "question": "임대료·관리비·권리금과 공실 기간을 중개사에게 확인했나요?"},
        ],
    )

