from __future__ import annotations

from dataclasses import dataclass
from typing import Any


RONE_API_BASE_URL = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"
RONE_SOURCE_URL = "https://www.reb.or.kr/reb/cm/cntnts/cntntsView.do?cntntsId=1049&mi=10335&statId=S237220284"
SEOUL_REGION_CODE = "500002"


@dataclass(frozen=True)
class RoneTableSpec:
    metric_key: str
    metric_label: str
    table_id: str
    building_type: str = "small_retail"


RONE_TABLES = (
    RoneTableSpec("rent_per_sqm", "소규모상가 임대료", "T269273143698159"),
    RoneTableSpec("vacancy_rate", "소규모상가 공실률", "T262053143683833"),
    RoneTableSpec("rent_price_index", "소규모상가 임대가격지수", "T266483143672471"),
)


def response_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result = payload.get("RESULT")
    if result:
        raise ValueError(f"R-ONE 응답 오류 {result.get('CODE')}: {result.get('MESSAGE')}")
    blocks = payload.get("SttsApiTblData") or []
    for block in blocks:
        if "row" in block:
            return list(block["row"] or [])
    return []


def latest_region_benchmark(
    payload: dict[str, Any],
    spec: RoneTableSpec,
    region_code: str = SEOUL_REGION_CODE,
) -> dict[str, Any]:
    rows = [row for row in response_rows(payload) if str(row.get("CLS_ID")) == region_code]
    if not rows:
        raise ValueError(f"R-ONE {spec.table_id} 응답에 지역 {region_code} 행이 없습니다.")
    row = max(rows, key=lambda item: str(item.get("WRTTIME_IDTFR_ID") or ""))
    value = row.get("DTA_VAL")
    if value in (None, ""):
        raise ValueError(f"R-ONE {spec.table_id} 최신 행의 값이 비어 있습니다.")
    return {
        "period_code": str(row["WRTTIME_IDTFR_ID"]),
        "period_label": str(row["WRTTIME_DESC"]),
        "region_code": str(row["CLS_ID"]),
        "region_name": str(row.get("CLS_FULLNM") or row["CLS_NM"]),
        "building_type": spec.building_type,
        "metric_key": spec.metric_key,
        "metric_label": spec.metric_label,
        "value": float(value),
        "unit": str(row["UI_NM"]),
        "table_id": spec.table_id,
        "item_id": str(row["ITM_ID"]),
        "mapping_scope": "administrative_context",
        "source_url": RONE_SOURCE_URL,
    }


def latest_seoul_benchmarks(
    payload: dict[str, Any],
    spec: RoneTableSpec,
) -> list[dict[str, Any]]:
    """Return the latest row for every official R-ONE Seoul region/market."""
    rows = [
        row
        for row in response_rows(payload)
        if str(row.get("CLS_FULLNM") or row.get("CLS_NM") or "") == "서울"
        or str(row.get("CLS_FULLNM") or "").startswith("서울>")
    ]
    if not rows:
        raise ValueError(f"R-ONE {spec.table_id} 응답에 서울 지역 행이 없습니다.")

    latest_by_region: dict[str, dict[str, Any]] = {}
    for row in rows:
        region_code = str(row.get("CLS_ID") or "")
        if not region_code:
            continue
        current = latest_by_region.get(region_code)
        if current is None or str(row.get("WRTTIME_IDTFR_ID") or "") > str(current.get("WRTTIME_IDTFR_ID") or ""):
            latest_by_region[region_code] = row

    parsed: list[dict[str, Any]] = []
    for region_code, row in sorted(latest_by_region.items()):
        value = row.get("DTA_VAL")
        if value in (None, ""):
            continue
        region_path = str(row.get("CLS_FULLNM") or row.get("CLS_NM") or region_code)
        parsed.append({
            "period_code": str(row["WRTTIME_IDTFR_ID"]),
            "period_label": str(row["WRTTIME_DESC"]),
            "region_code": region_code,
            "region_name": region_path,
            "building_type": spec.building_type,
            "metric_key": spec.metric_key,
            "metric_label": spec.metric_label,
            "value": float(value),
            "unit": str(row["UI_NM"]),
            "table_id": spec.table_id,
            "item_id": str(row["ITM_ID"]),
            "mapping_scope": "official_market_statistic" if region_code.startswith("52") else "administrative_context",
            "source_url": RONE_SOURCE_URL,
        })
    return parsed
