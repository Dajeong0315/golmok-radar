from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import SalesMetric
from test_api import client  # noqa: F401  (API 테스트와 같은 DB 준비를 쓴다)

SLOTS = ("00_06", "06_11", "11_14", "14_17", "17_21", "21_24")


def set_slots(code: str, values: tuple[int, ...]) -> None:
    session_gen = app.dependency_overrides[get_db]()
    session: Session = next(session_gen)
    with session.begin():
        session.execute(update(SalesMetric).where(
            SalesMetric.trade_area_code == code, SalesMetric.industry_code == "CS100010",
        ).values(**{f"sales_{slot}": value for slot, value in zip(SLOTS, values)}))
    session_gen.close()


def metric(body: dict, key: str) -> dict:
    return {value["trade_area_code"]: value for value in next(m for m in body["metrics"] if m["metric_key"] == key)["values"]}


def test_comparison_adds_six_time_slot_sales_ratios(client: TestClient) -> None:
    # 상권 1: 전체 1,000원, 상권 2: 전체 2,000원 (test_api 준비 데이터)
    set_slots("1", (0, 100, 350, 200, 300, 50))
    set_slots("2", (2, 398, 600, 400, 500, 100))
    body = client.get("/api/v1/comparisons", params={"codes": "1,2"}).json()
    keys = [m["metric_key"] for m in body["metrics"]]
    assert [f"sales_{slot}_ratio" for slot in SLOTS] == [key for key in keys if key.startswith("sales_") and key.endswith("_ratio")]
    labels = {m["metric_key"]: m["label"] for m in body["metrics"]}
    assert labels["sales_11_14_ratio"] == "11~14시 매출 비중"
    lunch = metric(body, "sales_11_14_ratio")
    assert lunch["1"]["value"] == 35.0 and lunch["2"]["value"] == 30.0
    assert metric(body, "sales_00_06_ratio")["2"]["value"] == 0.1


def test_rows_loaded_before_phase_41_are_not_turned_into_zero(client: TestClient) -> None:
    set_slots("1", (0, 100, 350, 200, 300, 50))
    body = client.get("/api/v1/comparisons", params={"codes": "1,3"}).json()
    lunch = metric(body, "sales_11_14_ratio")
    assert lunch["1"]["status"] == "available"
    assert lunch["3"]["status"] == "unavailable" and lunch["3"]["value"] is None
    assert lunch["3"]["reason"] == "계산에 필요한 원천값이 없습니다."


def test_store_only_industry_reports_missing_sales_slots(client: TestClient) -> None:
    body = client.get("/api/v1/comparisons", params={"codes": "1,2", "industry": "CS200004"}).json()
    for slot in SLOTS:
        assert {value["status"] for value in metric(body, f"sales_{slot}_ratio").values()} == {"unavailable"}


def test_evidence_shows_formula_inputs_and_sales_source(client: TestClient) -> None:
    set_slots("1", (0, 100, 350, 200, 300, 50))
    set_slots("2", (2, 398, 600, 400, 500, 100))
    body = client.get("/api/v1/comparisons/20254--1-2/evidence/sales_11_14_ratio").json()
    assert body["formula"] == "시간대 매출 금액 ÷ 전체 매출 금액 × 100"
    assert body["rounding"] == "소수 첫째 자리, ROUND_HALF_UP"
    assert body["source_file"] == "sales.csv"
    first = body["areas"][0]
    assert (first["numerator"], first["denominator"], first["value"]) == (350, 1000, 35.0)
    assert first["filter"]["industry_code"] == "CS100010"


def test_report_and_recommendation_do_not_interpret_sales_slots(client: TestClient) -> None:
    for code in "12345":
        set_slots(code, (0, 100 * int(code), 350, 200, 300, 50))
    report = client.get("/api/v1/trade-areas/1/report").json()
    keys = {item["metric_key"] for group in ("strengths", "cautions", "characteristics") for item in report[group]}
    assert not any(key.startswith("sales_") and key.endswith("_ratio") for key in keys)
    recommendation = client.post("/api/v1/recommendations", json={
        "business": "cafe", "demand": "office", "risk": "balanced",
        "operation": "solo", "strength": "product", "competition": "validated",
    }).json()
    assert recommendation["status"] == "available" and recommendation["candidates"]
    slot_keys = {f"sales_{slot}_ratio" for slot in SLOTS}
    for candidate in recommendation["candidates"]:
        assert not slot_keys & {reason["metric_key"] for reason in candidate["reasons"]}
