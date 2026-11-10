import csv
import json
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db import get_db
from app.main import app
from app.models import DataSource, PopulationMetric, SalesMetric, StoreMetric
from app.quarters import quarter_label
from database.scripts import fetch_quarter
from database.scripts.raw_sources import SALES_FORMATS, STORE_FORMATS, api_csv_path, resolve_quarter_file
from test_api import client  # noqa: F401  (API 테스트와 같은 DB 준비를 쓴다)


def add_quarter(client: TestClient, quarter: str, store_count: int, sales_amount: int | None, *, codes=("1", "2")) -> None:
    session_gen = app.dependency_overrides[get_db]()
    session: Session = next(session_gen)
    with session.begin():
        for code in codes:
            session.add(StoreMetric(quarter_code=quarter, trade_area_code=code, industry_code="CS100010",
                                    industry_name="커피-음료", store_count=store_count, opening_rate=1.0, closing_rate=2.0))
            if sales_amount is not None:
                session.add(SalesMetric(quarter_code=quarter, trade_area_code=code, industry_code="CS100010",
                                        industry_name="커피-음료", sales_amount=sales_amount, sales_count=10,
                                        weekday_sales_amount=sales_amount // 2, weekend_sales_amount=sales_amount - sales_amount // 2))
        session.add(DataSource(key=f"sales:{quarter}", dataset_name="sales API", provider="Open API",
                               source_file=f"sales_{quarter}_OpenAPI.csv", fetched_at=datetime(2026, 11, 10),
                               quarter_min=quarter, quarter_max=quarter))
    session_gen.close()


@pytest.fixture
def two_quarters(client: TestClient) -> TestClient:
    add_quarter(client, "20262", store_count=99, sales_amount=4000)
    return client


def test_quarter_label() -> None:
    assert quarter_label("20262") == "2026년 2분기"


def test_quarters_endpoint_lists_loaded_quarters_latest_first(two_quarters: TestClient) -> None:
    body = two_quarters.get("/api/v1/quarters").json()
    assert body["default_quarter"] == "20262"
    assert [item["code"] for item in body["quarters"]] == ["20262", "20254"]
    latest = body["quarters"][0]
    assert latest == {"code": "20262", "label": "2026년 2분기", "store_rows": 2, "sales_rows": 2, "population_rows": 0}


def test_default_quarter_is_latest_and_explicit_quarter_is_kept(two_quarters: TestClient) -> None:
    latest = two_quarters.get("/api/v1/comparisons", params={"codes": "1,2"}).json()
    assert latest["quarter_code"] == "20262" and latest["quarter_label"] == "2026년 2분기"
    stores = {area["trade_area_code"]: area["value"] for area in next(m for m in latest["metrics"] if m["metric_key"] == "store_count")["values"]}
    assert stores == {"1": 99, "2": 99}
    # 새 분기에 유동인구 행이 없으면 이전 분기 값을 빌려 쓰지 않고 비교 불가로 둔다.
    population = next(m for m in latest["metrics"] if m["metric_key"] == "total_population")
    assert {area["status"] for area in population["values"]} == {"unavailable"}

    older = two_quarters.get("/api/v1/comparisons", params={"codes": "1,2", "quarter": "20254"}).json()
    assert older["quarter_code"] == "20254" and older["comparison_id"].startswith("20254")
    stores = {area["trade_area_code"]: area["value"] for area in next(m for m in older["metrics"] if m["metric_key"] == "store_count")["values"]}
    assert stores == {"1": 10, "2": 20}


def test_unloaded_or_malformed_quarter_is_rejected(two_quarters: TestClient) -> None:
    for quarter in ("20253", "2026Q2"):
        assert two_quarters.get("/api/v1/comparisons", params={"codes": "1,2", "quarter": quarter}).status_code == 400
        assert two_quarters.get("/api/v1/industries", params={"quarter": quarter}).status_code == 400


def test_new_quarter_without_area_rows_is_not_filled_from_older_quarter(two_quarters: TestClient) -> None:
    response = two_quarters.get("/api/v1/comparisons", params={"codes": "1,3"}).json()
    store = next(m for m in response["metrics"] if m["metric_key"] == "store_count")
    by_code = {area["trade_area_code"]: area for area in store["values"]}
    assert by_code["1"]["value"] == 99
    assert by_code["3"]["status"] == "unavailable" and by_code["3"]["value"] is None


def test_evidence_uses_quarter_specific_source(two_quarters: TestClient) -> None:
    latest = two_quarters.get("/api/v1/comparisons/20262--1-2/evidence/sales_amount").json()
    assert latest["quarter_code"] == "20262" and latest["source_file"] == "sales_20262_OpenAPI.csv"
    older = two_quarters.get("/api/v1/comparisons/20254--1-2/evidence/sales_amount").json()
    assert older["source_file"] == "sales.csv"


def test_trade_area_list_and_industries_follow_requested_quarter(two_quarters: TestClient) -> None:
    latest = {area["code"]: area["data_status"] for area in two_quarters.get("/api/v1/trade-areas").json()}
    assert latest["1"] == {"store": True, "sales": True, "population": False}
    assert latest["3"]["store"] is False
    older = {area["code"]: area["data_status"] for area in two_quarters.get("/api/v1/trade-areas", params={"quarter": "20254"}).json()}
    assert older["3"] == {"store": True, "sales": True, "population": True}
    industries = {item["code"]: item for item in two_quarters.get("/api/v1/industries").json()}
    assert set(industries) == {"CS100010"} and industries["CS100010"]["store_area_count"] == 2


def test_configured_default_quarter_wins_when_loaded(two_quarters: TestClient, monkeypatch) -> None:
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "default_quarter", "20254")
    assert two_quarters.get("/api/v1/quarters").json()["default_quarter"] == "20254"
    monkeypatch.setattr(get_settings(), "default_quarter", "20193")
    assert two_quarters.get("/api/v1/quarters").json()["default_quarter"] == "20262"


# ---------------------------------------------------------------- Open API 수집기


def fake_api(rows: list[dict], quarter: str = "20262", reported: int | None = None):
    calls = []

    def call(_key, service, start, end, requested_quarter):
        calls.append((service, start, end, requested_quarter))
        page = rows[start - 1:end]
        return {service: {"list_total_count": reported if reported is not None else len(rows),
                          "RESULT": {"CODE": "INFO-000", "MESSAGE": "정상 처리되었습니다"}, "row": page}}

    return call, calls


def api_rows(count: int, quarter: str = "20262") -> list[dict]:
    columns = list(STORE_FORMATS["open_api"].values())
    return [{column: (quarter if column == "STDR_YYQU_CD" else f"A{index}" if column == "TRDAR_CD" else "1") for column in columns} for index in range(count)]


def test_fetch_pages_by_thousand_and_saves_csv_with_meta(tmp_path: Path) -> None:
    rows = api_rows(2_345)
    call, calls = fake_api(rows)
    columns, fetched, total = fetch_quarter.fetch("store", "20262", "secret-key", call=call, pause=0)
    assert total == 2_345 and len(fetched) == 2_345
    assert [(start, end) for _, start, end, _ in calls] == [(1, 1), (1, 1000), (1001, 2000), (2001, 2345)]
    assert {quarter for *_, quarter in calls} == {"20262"}
    path, meta_path = fetch_quarter.save("store", "20262", columns, fetched, total, raw=tmp_path)
    assert path == api_csv_path(tmp_path, "store", "20262")
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    assert meta["rows_saved"] == meta["total_count_reported"] == 2_345 and meta["service"] == "VwsmTrdarStorQq"
    assert "secret-key" not in path.read_text(encoding="utf-8-sig") + meta_path.read_text(encoding="utf-8")
    source = resolve_quarter_file(tmp_path, "store", "20262")
    assert source.origin == "openapi" and source.meta_path == meta_path


def test_fetch_refuses_partial_mixed_or_empty_results(tmp_path: Path) -> None:
    columns = list(STORE_FORMATS["open_api"].values())
    with pytest.raises(RuntimeError, match="달라"):
        fetch_quarter.save("store", "20262", columns, api_rows(3), 4, raw=tmp_path)
    with pytest.raises(RuntimeError, match="섞였"):
        fetch_quarter.save("store", "20262", columns, api_rows(1) + api_rows(1, "20261"), 2, raw=tmp_path)
    with pytest.raises(RuntimeError, match="공개되지 않았을"):
        fetch_quarter.save("store", "20263", columns, [], 0, raw=tmp_path)
    assert not list(tmp_path.rglob("*.csv"))
    with pytest.raises(RuntimeError, match="INFO-200"):
        fetch_quarter.body_of({"RESULT": {"CODE": "INFO-200", "MESSAGE": "해당하는 데이터가 없습니다."}}, "VwsmTrdarStorQq")


def test_quarter_file_prefers_openapi_csv_then_year_zip(tmp_path: Path) -> None:
    assert resolve_quarter_file(tmp_path, "sales", "20262") is None
    (tmp_path / "sales").mkdir()
    (tmp_path / "sales" / "서울시 상권분석서비스(추정매출-상권)_2026년.zip").write_bytes(b"zip")
    assert resolve_quarter_file(tmp_path, "sales", "20262").origin == "zip"
    api = api_csv_path(tmp_path, "sales", "20262")
    with api.open("w", encoding="utf-8-sig", newline="") as file:
        csv.writer(file).writerow(SALES_FORMATS["open_api"].values())
    assert resolve_quarter_file(tmp_path, "sales", "20262").origin == "openapi"
