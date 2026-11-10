from fastapi.testclient import TestClient

from test_api import client  # noqa: F401  (API 테스트와 같은 DB 준비를 쓴다)


def test_export_bundles_comparison_and_every_metric_evidence(client: TestClient) -> None:
    comparison = client.get("/api/v1/comparisons", params={"codes": "1,2,3"}).json()
    body = client.get(f"/api/v1/comparisons/{comparison['comparison_id']}/export").json()
    assert body["comparison"] == comparison
    assert [item["metric_key"] for item in body["evidence"]] == [metric["metric_key"] for metric in comparison["metrics"]]
    weekend = next(item for item in body["evidence"] if item["metric_key"] == "weekend_sales_ratio")
    assert weekend["formula"] == "주말 매출 금액 ÷ 전체 매출 금액 × 100"
    assert [(area["numerator"], area["denominator"]) for area in weekend["areas"]] == [(300, 1000), (600, 2000), (900, 3000)]
    assert weekend["dataset_name"] and weekend["provider"] and weekend["source_file"]
    assert body["generated_at"].endswith("+00:00")
    assert any("추천" in line and "성공 가능성" in line for line in body["limitations"])


def test_export_keeps_unavailable_values_with_reasons(client: TestClient) -> None:
    body = client.get("/api/v1/comparisons/20254~CS200004--1-2/export").json()
    sales = next(item for item in body["evidence"] if item["metric_key"] == "sales_amount")
    assert {area["status"] for area in sales["areas"]} == {"unavailable"}
    assert all(area["value"] is None and area["reason"] for area in sales["areas"])


def test_export_rejects_invalid_comparisons(client: TestClient) -> None:
    assert client.get("/api/v1/comparisons/20254--1/export").status_code == 400
    assert client.get("/api/v1/comparisons/20254--1-1/export").status_code == 400
    assert client.get("/api/v1/comparisons/20254--1-99/export").status_code == 404
    assert client.get("/api/v1/comparisons/20253--1-2/export").status_code == 400
