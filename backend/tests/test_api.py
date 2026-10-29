from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import Base, get_db, make_engine
from app.main import app
from app.models import DataSource, PopulationMetric, SalesMetric, StoreMetric, TradeArea


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
        "demand": "neighborhood",
        "risk": "lean",
        "operation": "solo",
        "strength": "branding",
        "competition": "avoid",
    })
    assert response.status_code == 200
    assert response.json()["status"] == "unsupported_business"
    assert response.json()["candidates"] == []


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


def test_rent_benchmark_does_not_present_quarterly_statistics_as_live_listing(client: TestClient) -> None:
    response = client.get("/api/v1/trade-areas/1/rent-benchmark")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "mapping_required"
    assert body["is_live_listing"] is False
    assert body["update_cycle"] == "분기"
    assert "공간 단위" in body["message"]


def test_support_programs_require_official_api_configuration(client: TestClient) -> None:
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


def test_review_analysis_exposes_samples_topics_and_evidence(client: TestClient) -> None:
    response = client.post("/api/v1/review-analysis", json={
        "own_shop_name": "내 카페",
        "comparison_scope": "반경 500m 동종 카페 3곳",
        "period_label": "2026년 10월",
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
        "own_reviews": ["맛있어요"],
        "nearby_reviews": ["맛있어요"],
    })
    assert response.status_code == 200
    assert response.json()["status"] == "insufficient_sample"
    assert response.json()["insights"] == []

