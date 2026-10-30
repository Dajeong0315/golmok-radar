import pytest

from app.rone import RoneTableSpec, latest_region_benchmark, response_rows


def payload(rows):
    return {
        "SttsApiTblData": [
            {"head": [{"list_total_count": len(rows)}, {"RESULT": {"CODE": "INFO-000"}}]},
            {"row": rows},
        ]
    }


def test_latest_region_benchmark_selects_latest_period_and_preserves_unit() -> None:
    spec = RoneTableSpec("rent_per_sqm", "소규모상가 임대료", "table-1")
    parsed = latest_region_benchmark(payload([
        {"WRTTIME_IDTFR_ID": "202602", "WRTTIME_DESC": "2026년 2분기", "CLS_ID": 500002, "CLS_NM": "서울", "ITM_ID": 100001, "DTA_VAL": 52.0, "UI_NM": "천원/㎡"},
        {"WRTTIME_IDTFR_ID": "202603", "WRTTIME_DESC": "2026년 3분기", "CLS_ID": 500002, "CLS_NM": "서울", "ITM_ID": 100001, "DTA_VAL": 53.08, "UI_NM": "천원/㎡"},
    ]), spec)

    assert parsed["period_code"] == "202603"
    assert parsed["value"] == 53.08
    assert parsed["unit"] == "천원/㎡"
    assert parsed["mapping_scope"] == "administrative_context"


def test_rone_parser_rejects_api_errors_and_missing_region() -> None:
    with pytest.raises(ValueError, match="ERROR-336"):
        response_rows({"RESULT": {"CODE": "ERROR-336", "MESSAGE": "요청 한도 초과"}})

    with pytest.raises(ValueError, match="지역 500002"):
        latest_region_benchmark(payload([]), RoneTableSpec("vacancy_rate", "공실률", "table-2"))
