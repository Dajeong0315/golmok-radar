from collections.abc import Generator
from datetime import date, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db import Base, get_db, make_engine
from app.main import app, settings
from app.models import DataSource, PopulationMetric, RentBenchmark, SalesMetric, StoreMetric, SupportProgram, TradeArea
from app.review_auth import get_review_user
from app.schemas import ReviewPlaceRef
from app.trade_area_geometry import AreaLocation


@pytest.fixture
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    engine = make_engine(f"sqlite:///{(tmp_path / 'api.db').as_posix()}")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add_all(
            [
                DataSource(
                    key=key,
                    dataset_name=f"{key} dataset",
                    provider="서울신용보증재단",
                    source_file=f"{key}.csv",
                )
                for key in ("area", "store", "sales", "population")
            ]
        )
        session.add_all(
            [
                RentBenchmark(
                    period_code="202603",
                    period_label="2026년 3분기",
                    region_code="500002",
                    region_name="서울",
                    building_type="small_retail",
                    metric_key=metric_key,
                    metric_label=label,
                    value=value,
                    unit=unit,
                    table_id=table_id,
                    item_id="100001",
                    mapping_scope="administrative_context",
                    fetched_at=datetime(2026, 10, 30, 9, 0, 0),
                    source_url="https://www.reb.or.kr/r-one/",
                )
                for metric_key, label, value, unit, table_id in (
                    ("rent_per_sqm", "소규모상가 임대료", 53.08, "천원/㎡", "rent-table"),
                    ("vacancy_rate", "소규모상가 공실률", 6.58, "%", "vacancy-table"),
                    ("rent_price_index", "소규모상가 임대가격지수", 100.2, "지수", "index-table"),
                )
            ]
        )
        session.add_all(
            [
                RentBenchmark(
                    period_code="202603",
                    period_label="2026년 3분기",
                    region_code="520037",
                    region_name="서울>기타>뚝섬",
                    building_type="small_retail",
                    metric_key=metric_key,
                    metric_label=label,
                    value=value,
                    unit=unit,
                    table_id=table_id,
                    item_id="100001",
                    mapping_scope="official_market_statistic",
                    fetched_at=datetime(2026, 10, 30, 9, 0, 0),
                    source_url="https://www.reb.or.kr/r-one/",
                )
                for metric_key, label, value, unit, table_id in (
                    ("rent_per_sqm", "소규모상가 임대료", 67.38, "천원/㎡", "rent-table"),
                    ("vacancy_rate", "소규모상가 공실률", 6.88, "%", "vacancy-table"),
                    ("rent_price_index", "소규모상가 임대가격지수", 103.69, "지수", "index-table"),
                )
            ]
        )
        for index in range(1, 6):
            code = str(index)
            session.add(
                TradeArea(
                    code=code,
                    name=f"상권 {index}",
                    district_code="11200",
                    district_name="성동구",
                    area_type_code="A",
                    area_type_name="골목상권",
                    x_epsg5181=200000 + index,
                    y_epsg5181=450000 + index,
                    longitude=127.0 + index / 100,
                    latitude=37.5 + index / 100,
                )
            )
            session.add(
                StoreMetric(
                    quarter_code="20254",
                    trade_area_code=code,
                    industry_code="CS100010",
                    industry_name="커피-음료",
                    store_count=index * 10,
                    opening_rate=5.0,
                    closing_rate=3.0,
                )
            )
            if index <= 3:
                session.add(StoreMetric(
                    quarter_code="20254", trade_area_code=code,
                    industry_code="CS200004", industry_name="컴퓨터학원",
                    store_count=2, opening_rate=None, closing_rate=None,
                ))
            session.add(
                SalesMetric(
                    quarter_code="20254",
                    trade_area_code=code,
                    industry_code="CS100010",
                    industry_name="커피-음료",
                    sales_amount=1_000 * index,
                    sales_count=10 * index,
                    weekday_sales_amount=700 * index,
                    weekend_sales_amount=300 * index,
                )
            )
            session.add(
                PopulationMetric(
                    quarter_code="20254",
                    trade_area_code=code,
                    total_population=1_000 * index,
                    population_00_06=100 * index,
                    population_06_11=200 * index,
                    population_11_14=100 * index,
                    population_14_17=200 * index,
                    population_17_21=300 * index,
                    population_21_24=100 * index,
                )
            )

    def override_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_trade_area_list_and_detail(client: TestClient) -> None:
    response = client.get("/api/v1/trade-areas", params={"district": "성동구"})
    assert response.status_code == 200
    assert len(response.json()) == 5
    assert response.json()[0]["data_status"] == {"store": True, "sales": True, "population": True}

    detail = client.get("/api/v1/trade-areas/1")
    assert detail.status_code == 200
    assert detail.json()["name"] == "상권 1"


def test_industries_expose_only_loaded_official_industries(client: TestClient) -> None:
    response = client.get("/api/v1/industries")
    assert response.status_code == 200
    assert response.json() == [
        {"code": "CS100010", "name": "커피-음료", "store_area_count": 5, "sales_area_count": 5, "has_sales_source": True},
        {"code": "CS200004", "name": "컴퓨터학원", "store_area_count": 3, "sales_area_count": 0, "has_sales_source": False},
    ]


def test_trade_area_map_insight_exposes_trade_area_metrics_without_street_claims(client: TestClient) -> None:
    response = client.get("/api/v1/trade-areas/1/map-insight")
    assert response.status_code == 200
    body = response.json()
    assert body["total_population"]["value"] == 1000
    assert body["sales_amount"]["value"] == 1000
    assert body["weekend_sales_ratio"]["value"] == 30.0
    assert body["time_slots"][2] == {
        "metric_key": "population_11_14", "label": "11~14시", "unit": "명",
        "status": "available", "value": 100.0, "reason": None, "percentile": None, "ratio": 10.0,
    }
    assert body["sales_amount"]["percentile"] == 0.0
    assert body["comparison_group_label"] == "같은 자치구의 커피-음료 통계 보유 공식 상권"
    assert "거리별" in body["notice"]


@pytest.mark.parametrize("codes", ["1,2", "1,2,3", "1,2,3,4"])
def test_comparison_accepts_two_to_four_codes(client: TestClient, codes: str) -> None:
    response = client.get("/api/v1/comparisons", params={"codes": codes, "quarter": "20254"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["trade_areas"]) == len(codes.split(","))
    weekend = next(metric for metric in body["metrics"] if metric["metric_key"] == "weekend_sales_ratio")
    assert all(value["value"] == 30.0 for value in weekend["values"])


@pytest.mark.parametrize(
    ("codes", "status"),
    [("1", 400), ("1,2,3,4,5", 400), ("1,1", 400), ("1,99", 404)],
)
def test_comparison_rejects_invalid_codes(client: TestClient, codes: str, status: int) -> None:
    assert client.get("/api/v1/comparisons", params={"codes": codes}).status_code == status


def test_comparison_rejects_unsupported_quarter(client: TestClient) -> None:
    response = client.get("/api/v1/comparisons", params={"codes": "1,2", "quarter": "20253"})
    assert response.status_code == 400


def test_evidence_exposes_formula_and_inputs(client: TestClient) -> None:
    response = client.get("/api/v1/comparisons/20254--1-2/evidence/weekend_sales_ratio")
    assert response.status_code == 200
    body = response.json()
    assert body["formula"] == "주말 매출 금액 ÷ 전체 매출 금액 × 100"
    assert body["areas"][0]["numerator"] == 300
    assert body["areas"][0]["denominator"] == 1000


def test_checklist_and_health(client: TestClient) -> None:
    assert client.get("/health").json() == {"status": "ok"}
    checklist = client.get("/api/v1/field-checklist")
    assert checklist.status_code == 200
    assert len(checklist.json()["items"]) == 5


def test_recommendations_return_explainable_candidates(client: TestClient) -> None:
    response = client.post("/api/v1/recommendations", json={
        "business": "cafe",
        "demand": "office",
        "risk": "balanced",
        "operation": "solo",
        "strength": "product",
        "competition": "validated",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert body["candidate_pool_size"] == 5
    assert len(body["candidates"]) == 3
    assert all(candidate["data_completeness"] == "14/14" for candidate in body["candidates"])
    assert all(len(candidate["reasons"]) == 3 for candidate in body["candidates"])
    assert body["candidates"][0]["score"] >= body["candidates"][1]["score"]


def test_recommendations_do_not_invent_unsupported_industry(client: TestClient) -> None:
    response = client.post("/api/v1/recommendations", json={
        "business": "retail",
        "industry_code": "CS999999",
        "demand": "neighborhood",
        "risk": "lean",
        "operation": "solo",
        "strength": "branding",
        "competition": "avoid",
    })
    assert response.status_code == 200
    assert response.json()["status"] == "unsupported_business"
    assert response.json()["candidates"] == []


def test_store_only_industry_comparison_report_and_recommendation(client: TestClient) -> None:
    comparison = client.get("/api/v1/comparisons", params={"codes": "1,2", "industry": "CS200004"})
    assert comparison.status_code == 200
    body = comparison.json()
    assert body["industry_name"] == "컴퓨터학원"
    assert body["comparison_id"] == "20254~CS200004--1-2"
    metrics = {item["metric_key"]: item for item in body["metrics"]}
    assert metrics["store_count"]["label"] == "컴퓨터학원 점포 수"
    assert metrics["sales_amount"]["values"][0]["status"] == "unavailable"
    assert metrics["sales_amount"]["values"][0]["value"] is None
    evidence = client.get("/api/v1/comparisons/20254~CS200004--1-2/evidence/store_count")
    assert evidence.status_code == 200
    assert evidence.json()["industry_code"] == "CS200004"
    report = client.get("/api/v1/trade-areas/1/report", params={"industry": "CS200004"})
    assert report.status_code == 200
    assert report.json()["industry_name"] == "컴퓨터학원"
    assert any(item["metric_key"] == "sales_amount" and item["percentile"] is None for item in report.json()["cautions"])
    recommendation = client.post("/api/v1/recommendations", json={
        "business": "service", "industry_code": "CS200004", "demand": "neighborhood",
        "risk": "lean", "operation": "solo", "strength": "product", "competition": "avoid",
    })
    assert recommendation.status_code == 200
    assert recommendation.json()["industry_code"] == "CS200004"
    assert recommendation.json()["candidate_pool_size"] == 3
    assert all(item["data_completeness"] == "8/14" for item in recommendation.json()["candidates"])


def test_area_report_links_every_statement_to_metric_evidence(client: TestClient) -> None:
    response = client.get("/api/v1/trade-areas/5/report")
    assert response.status_code == 200
    body = response.json()
    assert body["comparison_count"] == 5
    assert body["strengths"]
    for item in body["strengths"] + body["cautions"] + body["characteristics"]:
        assert item["metric_key"]
        assert item["percentile"] is not None
        assert item["summary"]


def test_rent_benchmark_exposes_seoul_context_without_presenting_it_as_live_listing(client: TestClient) -> None:
    response = client.get("/api/v1/trade-areas/1/rent-benchmark")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert body["is_live_listing"] is False
    assert body["update_cycle"] == "분기"
    assert body["source_region"] == "서울 전체"
    assert body["mapping_scope"] == "administrative_context"
    assert body["confidence"] == "contextual"
    assert len(body["metrics"]) == 3
    assert len(body["seoul_metrics"]) == 3
    assert "서울 전체" in body["message"]


def test_rent_markets_and_selected_official_market_are_exposed_separately(client: TestClient) -> None:
    markets = client.get("/api/v1/rent-markets")
    assert markets.status_code == 200
    assert markets.json()["markets"] == [{
        "region_code": "520037",
        "name": "뚝섬",
        "group": "기타",
        "source_period": "2026년 3분기",
    }]

    response = client.get("/api/v1/trade-areas/1/rent-benchmark", params={"market_code": "520037"})
    assert response.status_code == 200
    body = response.json()
    assert body["source_region"] == "서울 · 기타 · 뚝섬"
    assert body["mapping_scope"] == "official_market_statistic"
    assert body["selected_market_code"] == "520037"
    assert next(metric for metric in body["metrics"] if metric["metric_key"] == "rent_per_sqm")["value"] == 67.38
    assert next(metric for metric in body["seoul_metrics"] if metric["metric_key"] == "rent_per_sqm")["value"] == 53.08


def test_rent_benchmark_returns_reason_instead_of_zero_when_source_is_missing(client: TestClient) -> None:
    override_db = app.dependency_overrides[get_db]
    database = override_db()
    session = next(database)
    try:
        session.execute(delete(RentBenchmark))
        session.commit()
    finally:
        database.close()

    response = client.get("/api/v1/trade-areas/1/rent-benchmark")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "mapping_required"
    assert body["metrics"] == []
    assert "0으로 대체하지 않습니다" in body["message"]


def test_support_programs_require_official_api_configuration(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "k_startup_api_key", None)
    response = client.post("/api/v1/support-programs", json={
        "stage": "pre_startup",
        "region": "서울",
        "age": 31,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "configuration_required"
    assert body["required_setting"] == "K_STARTUP_API_KEY"
    assert body["candidates"] == []
    assert "가상 상품" in body["message"]


def test_support_programs_return_two_explainable_current_candidates(client: TestClient) -> None:
    override_db = app.dependency_overrides[get_db]
    database = override_db()
    session = next(database)
    try:
        session.add_all([
            SupportProgram(
                program_id=f"program-{index}",
                title=f"공식 공고 {index}",
                application_start=date(2020, 1, 1),
                application_end=date(2099, 12, 31),
                regions=["전국"],
                stages=["pre_startup"],
                minimum_age=20,
                maximum_age=39,
                maximum_years_in_business=None,
                source_url=f"https://www.k-startup.go.kr/program-{index}",
                support_type="사업화",
                target_text="예비창업자 중 세부 조건 충족자",
                region_text="전국",
                business_age_text="예비창업자",
                age_text="만 20세 이상 ~ 만 39세 이하",
                unparsed_conditions=[],
                fetched_at=datetime(2026, 10, 30, 10, 0, 0),
            ) for index in range(3)
        ])
        session.commit()
    finally:
        database.close()

    response = client.post("/api/v1/support-programs", json={
        "stage": "pre_startup", "region": "서울", "age": 31,
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert len(body["candidates"]) == 2
    assert body["candidates"][0]["support_type"] == "사업화"
    assert body["candidates"][0]["reasons"]
    assert body["candidates"][0]["needs_confirmation"]


def test_review_analysis_exposes_samples_topics_and_evidence(client: TestClient) -> None:
    response = client.post("/api/v1/review-analysis", json={
        "own_shop_name": "내 카페",
        "comparison_scope": "반경 500m 동종 카페 3곳",
        "period_label": "2026년 10월",
        "ownership_confirmed": True,
        "data_rights_confirmed": True,
        "own_reviews": ["서비스가 불친절해요", "응대가 불친절해요", "커피가 맛있어요", "가격이 비싸요", "공간이 깨끗해요"],
        "nearby_reviews": ["서비스가 친절해요", "응대가 친절해요", "커피가 맛있어요", "가격이 저렴해요", "공간이 깨끗해요"],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "available"
    assert body["source"] == "user_provided"
    assert body["own_sample_count"] == 5
    service = next(topic for topic in body["topics"] if topic["topic_key"] == "service")
    assert service["own"]["negative"] == 2
    assert service["own"]["evidence"][0]["review_index"] == 1
    assert any(item["kind"] == "caution" for item in body["insights"])


def test_review_analysis_hides_strategy_when_sample_is_too_small(client: TestClient) -> None:
    response = client.post("/api/v1/review-analysis", json={
        "own_shop_name": "내 카페",
        "comparison_scope": "주변",
        "period_label": "최근",
        "ownership_confirmed": True,
        "data_rights_confirmed": True,
        "own_reviews": ["맛있어요"],
        "nearby_reviews": ["맛있어요"],
    })
    assert response.status_code == 200
    assert response.json()["status"] == "insufficient_sample"
    assert response.json()["insights"] == []


def test_review_analysis_requires_rights_confirmation_and_redacts_contacts(client: TestClient) -> None:
    payload = {
        "own_shop_name": "내 카페",
        "comparison_scope": "반경 500m · 카페 · 3곳",
        "period_label": "최근 3개월",
        "ownership_confirmed": False,
        "data_rights_confirmed": True,
        "own_reviews": ["연락처 010-1234-5678, 서비스가 친절해요"],
        "nearby_reviews": ["서비스가 친절해요"],
    }
    denied = client.post("/api/v1/review-analysis", json=payload)
    assert denied.status_code == 400

    payload["ownership_confirmed"] = True
    allowed = client.post("/api/v1/review-analysis", json=payload)
    evidence = next(topic for topic in allowed.json()["topics"] if topic["topic_key"] == "service")["own"]["evidence"]
    assert evidence[0]["snippet"].startswith("연락처 [전화번호 제거]")
    assert "010-1234-5678" not in evidence[0]["snippet"]


def test_review_area_location_and_capture_require_login(client: TestClient, monkeypatch) -> None:
    from app import main

    monkeypatch.setattr(main, "locate_area", lambda _lat, _lon: AreaLocation("1", "inside", 0))
    place = {"id": "123", "latitude": 37.51, "longitude": 127.01}
    located = client.get("/api/v1/review-trade-area", params={"latitude": place["latitude"], "longitude": place["longitude"]})
    assert located.status_code == 200
    assert located.json()["area"]["code"] == "1"
    assert located.json()["status"] == "inside"

    denied = client.post("/api/v1/captured-review-report", json={
        "own": place, "candidates": [], "ownership_confirmed": True,
    })
    assert denied.status_code == 401


def test_capture_report_validates_ownership_and_returns_aggregate_only(client: TestClient, monkeypatch) -> None:
    from app import main
    from app.schemas import CapturedReviewReportResponse

    app.dependency_overrides[get_review_user] = lambda: "test-user"
    monkeypatch.setattr(main.settings, "kakao_rest_api_key", "test-key")
    monkeypatch.setattr(main, "verified_kakao_place", lambda place, _key: ReviewPlaceRef(
        id=place.id, latitude=place.latitude, longitude=place.longitude, name="카페", category="음식점 > 카페",
    ))
    monkeypatch.setattr(main, "locate_area", lambda _lat, _lon: AreaLocation("1", "inside", 0))
    monkeypatch.setattr(main, "select_peer_places", lambda *_args, **_kwargs: [
        (ReviewPlaceRef(id="456", latitude=37.5101, longitude=127.0101), True),
        (ReviewPlaceRef(id="789", latitude=37.5102, longitude=127.0102), True),
    ])
    monkeypatch.setattr(main, "collect_or_load_report", lambda **kwargs: CapturedReviewReportResponse(
        status="insufficient_sample", area=kwargs["area"], own_review_count=3,
        peer_samples=[], total_review_count=3, eligible_place_count=0,
        required_place_count=5, required_review_count=50, topics=[], insights=[],
        failed_labels=[], captured_at=None, expires_at=None, from_cache=False,
        source="kakao", message="표본 부족",
    ))
    payload = {"own": {"id": "123", "latitude": 37.51, "longitude": 127.01}, "candidates": [], "ownership_confirmed": False}
    try:
        assert client.post("/api/v1/captured-review-report", json=payload).status_code == 400
        payload["ownership_confirmed"] = True
        response = client.post("/api/v1/captured-review-report", json=payload)
        assert response.status_code == 200
        assert response.json()["status"] == "insufficient_sample"
        assert response.json()["area"]["code"] == "1"
        assert "reviews" not in response.json()
    finally:
        app.dependency_overrides.pop(get_review_user, None)


def test_capture_report_allows_nearby_area_without_claiming_membership(client: TestClient, monkeypatch) -> None:
    from app import main
    from app.schemas import CapturedReviewReportResponse

    app.dependency_overrides[get_review_user] = lambda: "test-user"
    monkeypatch.setattr(main.settings, "kakao_rest_api_key", "test-key")
    monkeypatch.setattr(main, "verified_kakao_place", lambda place, _key: ReviewPlaceRef(
        id=place.id, latitude=place.latitude, longitude=place.longitude, name="카페", category="음식점 > 카페",
    ))
    monkeypatch.setattr(main, "locate_area", lambda _lat, _lon: AreaLocation("1", "nearby", 75))
    seen = {}

    def fake_report(**kwargs):
        seen.update(kwargs)
        return CapturedReviewReportResponse(
            status="insufficient_sample", area=kwargs["area"], location_status=kwargs["location_status"],
            area_distance_m=kwargs["area_distance_m"], own_review_count=0, peer_samples=[],
            total_review_count=0, eligible_place_count=0, required_place_count=3,
            required_review_count=30, topics=[], insights=[], failed_labels=[],
            captured_at=None, expires_at=None, from_cache=False, source="kakao", message="표본 부족",
        )

    monkeypatch.setattr(main, "collect_or_load_report", fake_report)
    payload = {"own": {"id": "123", "latitude": 37.51, "longitude": 127.01}, "candidates": [
        {"id": "456", "latitude": 37.5101, "longitude": 127.0101},
        {"id": "789", "latitude": 37.5102, "longitude": 127.0102},
    ], "ownership_confirmed": True}
    try:
        response = client.post("/api/v1/captured-review-report", json=payload)
        assert response.status_code == 200
        assert response.json()["location_status"] == "nearby"
        assert response.json()["area_distance_m"] == 75
        assert seen["peers"][0][1] is False
    finally:
        app.dependency_overrides.pop(get_review_user, None)


def test_area_review_report_keeps_only_verified_same_industry_places(client: TestClient, monkeypatch) -> None:
    from app import main
    from app.schemas import AreaReviewReportResponse

    app.dependency_overrides[get_review_user] = lambda: "test-user"
    monkeypatch.setattr(main.settings, "kakao_rest_api_key", "test-key")
    monkeypatch.setattr(main, "locate_area", lambda _lat, _lon: AreaLocation("1", "inside", 0))
    monkeypatch.setattr(main, "verified_kakao_place", lambda place, _key: ReviewPlaceRef(
        id=place.id, latitude=place.latitude, longitude=place.longitude,
        name=place.name, category="교육 > 컴퓨터학원" if place.id != "4" else "음식점 > 카페",
    ))
    seen = {}

    def fake_report(**kwargs):
        seen.update(kwargs)
        return AreaReviewReportResponse(
            status="insufficient_sample", area=kwargs["area"],
            industry_code=kwargs["industry_code"], industry_name=kwargs["industry_name"],
            place_samples=[], total_review_count=0, analyzed_review_count=0,
            eligible_place_count=0, required_place_count=3, required_review_count=30,
            topics=[], failed_labels=[], captured_at=None, expires_at=None,
            from_cache=False, source="kakao", message="표본 부족",
        )

    monkeypatch.setattr(main, "collect_or_load_area_review_report", fake_report)
    payload = {"trade_area_code": "1", "industry_code": "CS200004", "candidates": [
        {"id": str(index), "name": f"가게 {index}", "latitude": 37.51 + index / 10000,
         "longitude": 127.01 + index / 10000} for index in range(1, 5)
    ]}
    try:
        mapping = client.get("/api/v1/review-industry/CS200004")
        assert mapping.status_code == 200
        assert mapping.json()["terms"] == ["컴퓨터학원"]
        response = client.post("/api/v1/area-review-report", json=payload)
        assert response.status_code == 200
        assert response.json()["industry_code"] == "CS200004"
        assert [place.id for place in seen["places"]] == ["1", "2", "3"]
        assert "가게 1" not in response.text
        payload["candidates"] = payload["candidates"][:2]
        insufficient = client.post("/api/v1/area-review-report", json=payload)
        assert insufficient.status_code == 200
        assert [place.id for place in seen["places"]] == ["1", "2"]
    finally:
        app.dependency_overrides.pop(get_review_user, None)


def test_own_review_rejects_mismatched_verified_kakao_category(client: TestClient, monkeypatch) -> None:
    from app import main

    app.dependency_overrides[get_review_user] = lambda: "test-user"
    monkeypatch.setattr(main.settings, "kakao_rest_api_key", "test-key")
    monkeypatch.setattr(main, "verified_kakao_place", lambda place, _key: ReviewPlaceRef(
        id=place.id, latitude=place.latitude, longitude=place.longitude,
        name="다른 가게", category="음식점 > 한식",
    ))
    monkeypatch.setattr(main, "collect_or_load_report", lambda **_kwargs: pytest.fail("분류 불일치 장소를 수집했습니다"))
    try:
        response = client.post("/api/v1/captured-review-report", json={
            "own": {"id": "123", "name": "카페", "latitude": 37.51, "longitude": 127.01},
            "candidates": [], "ownership_confirmed": True, "industry_code": "CS100010",
        })
        assert response.status_code == 400
        assert "분류" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_review_user, None)


def test_own_review_skips_unverified_peer_and_uses_next_candidate(client: TestClient, monkeypatch) -> None:
    from app import main
    from app.schemas import CapturedReviewReportResponse

    app.dependency_overrides[get_review_user] = lambda: "test-user"
    monkeypatch.setattr(main.settings, "kakao_rest_api_key", "test-key")
    monkeypatch.setattr(main, "locate_area", lambda _lat, _lon: AreaLocation("1", "inside", 0))

    def verify(place, _key):
        if place.id == "2":
            raise ValueError("장소 재확인 실패")
        return ReviewPlaceRef(id=place.id, latitude=place.latitude, longitude=place.longitude,
                              name="카페", category="음식점 > 카페")

    monkeypatch.setattr(main, "verified_kakao_place", verify)
    seen = {}

    def fake_report(**kwargs):
        seen.update(kwargs)
        return CapturedReviewReportResponse(
            status="insufficient_sample", area=kwargs["area"], own_review_count=0,
            peer_samples=[], total_review_count=0, eligible_place_count=0,
            required_place_count=3, required_review_count=30, topics=[], insights=[],
            failed_labels=[], captured_at=None, expires_at=None, from_cache=False,
            source="kakao", message="표본 없음",
        )

    monkeypatch.setattr(main, "collect_or_load_report", fake_report)
    payload = {"own": {"id": "1", "name": "카페", "latitude": 37.51, "longitude": 127.01},
               "candidates": [{"id": str(index), "name": "카페", "latitude": 37.51,
                               "longitude": 127.01 + index / 100000} for index in (2, 3, 4)],
               "ownership_confirmed": True}
    try:
        response = client.post("/api/v1/captured-review-report", json=payload)
        assert response.status_code == 200
        assert [peer.id for peer, _ in seen["peers"]] == ["3", "4"]
    finally:
        app.dependency_overrides.pop(get_review_user, None)

