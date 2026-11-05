from __future__ import annotations

from sqlalchemy.orm import Session

from .metric_service import get_all_area_metrics
from .models import TradeArea
from .recommendations import percentile


POSITIVE_METRICS = {"sales_amount", "total_population", "average_payment"}
CONTEXT_METRICS = {
    "store_count", "weekday_sales_ratio", "weekend_sales_ratio",
    "population_00_06_ratio", "population_06_11_ratio", "population_11_14_ratio",
    "population_14_17_ratio", "population_17_21_ratio", "population_21_24_ratio",
}


def build_area_report(session: Session, code: str, quarter: str = "20254", industry: str = "CS100010") -> dict | None:
    target = session.get(TradeArea, code)
    if target is None:
        return None

    records: dict[str, dict[str, tuple[str, str, float]]] = {}
    for area, metrics in get_all_area_metrics(session, quarter, industry):
        available = {
            metric.metric_key: (metric.label, metric.unit, float(metric.value))
            for metric in metrics if metric.status == "available" and metric.value is not None
        }
        if "store_count" in available and "total_population" in available:
            records[area.code] = available

    if code not in records or len(records) < 2:
        return {
            "area": target, "comparison_count": len(records), "strengths": [],
            "cautions": [{
                "metric_key": "data_completeness", "label": "비교 자료",
                "value": None, "unit": "", "percentile": None,
                "summary": "이 업종의 점포 수와 유동인구가 있는 비교 상권이 충분하지 않아 상대 위치를 계산할 수 없습니다.",
            }],
            "characteristics": [],
        }

    target_metrics = records[code]
    strengths, cautions, characteristics = [], [], []
    for key, (label, unit, value) in target_metrics.items():
        values = [record[key][2] for record in records.values() if key in record]
        if len(values) < 2:
            continue
        rank = percentile(value, values)
        insight = {"metric_key": key, "label": label, "value": value, "unit": unit, "percentile": rank}
        if key in POSITIVE_METRICS and rank >= 70:
            strengths.append({**insight, "summary": f"같은 업종의 비교 가능한 상권 {len(values)}곳 중 상위 30%에 드는 수치입니다."})
        elif key in POSITIVE_METRICS and rank <= 30:
            cautions.append({**insight, "summary": "같은 업종의 비교 상권에서 하위 30%입니다. 현장 수요와 실제 조건을 함께 확인하세요."})
        elif key == "closing_rate" and rank >= 70:
            cautions.append({**insight, "summary": "폐업률이 같은 업종의 비교 상권에서 상위 30%입니다. 원인을 현장에서 확인하세요."})
        elif key == "closing_rate" and rank <= 30:
            strengths.append({**insight, "summary": "폐업률이 같은 업종의 비교 상권에서 하위 30%입니다. 이 수치만으로 안정성을 판단할 수는 없습니다."})
        elif key in CONTEXT_METRICS and (rank >= 70 or rank <= 30):
            position = "높은" if rank >= 70 else "낮은"
            characteristics.append({**insight, "summary": f"같은 업종의 비교 상권에서 {position} 편입니다. 현장의 특성으로 확인해 보세요."})

    if "sales_amount" not in target_metrics:
        cautions.append({
            "metric_key": "sales_amount", "label": "업종 추정매출", "value": None,
            "unit": "원", "percentile": None,
            "summary": "이 상권·업종의 해당 분기 매출 원천이 없어 매출 비교는 제공하지 않습니다.",
        })
    return {
        "area": target, "comparison_count": len(records),
        "strengths": sorted(strengths, key=lambda item: item["percentile"], reverse=True),
        "cautions": sorted(cautions, key=lambda item: item["percentile"] if item["percentile"] is not None else 101),
        "characteristics": sorted(characteristics, key=lambda item: abs(item["percentile"] - 50), reverse=True)[:3],
    }
