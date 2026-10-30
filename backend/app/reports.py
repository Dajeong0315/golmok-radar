from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .metric_service import get_area_metrics
from .models import TradeArea
from .recommendations import percentile


POSITIVE_METRICS = {"sales_amount", "total_population", "average_payment"}
CONTEXT_METRICS = {
    "store_count",
    "weekday_sales_ratio",
    "weekend_sales_ratio",
    "population_00_06_ratio",
    "population_06_11_ratio",
    "population_11_14_ratio",
    "population_14_17_ratio",
    "population_17_21_ratio",
    "population_21_24_ratio",
}


def build_area_report(session: Session, code: str, quarter: str = "20254") -> dict | None:
    target = session.get(TradeArea, code)
    if not target:
        return None

    records: dict[str, dict[str, tuple[str, str, float]]] = {}
    for area in session.scalars(select(TradeArea)).all():
        _, metrics = get_area_metrics(session, area.code, quarter)
        available = {
            metric.metric_key: (metric.label, metric.unit, float(metric.value))
            for metric in metrics
            if metric.status == "available" and metric.value is not None
        }
        if len(available) == 14:
            records[area.code] = available

    if code not in records:
        return {
            "area": target,
            "comparison_count": len(records),
            "strengths": [],
            "cautions": [{
                "metric_key": "data_completeness",
                "label": "데이터 완전성",
                "value": None,
                "unit": "",
                "percentile": None,
                "summary": "점포·매출·인구 데이터가 모두 없어 상대 분석을 만들 수 없습니다.",
            }],
            "characteristics": [],
        }

    target_metrics = records[code]
    distributions = {
        key: [metrics[key][2] for metrics in records.values()]
        for key in target_metrics
    }
    insights = []
    for key, (label, unit, value) in target_metrics.items():
        rank = percentile(value, distributions[key])
        insights.append({
            "metric_key": key,
            "label": label,
            "value": value,
            "unit": unit,
            "percentile": rank,
        })

    strengths = []
    cautions = []
    characteristics = []
    for insight in insights:
        key = insight["metric_key"]
        rank = insight["percentile"]
        if key in POSITIVE_METRICS and rank >= 70:
            strengths.append({**insight, "summary": f"비교 가능한 카페 상권 {len(records)}곳 가운데 이 수치가 상위 30%에 들어요."})
        elif key in POSITIVE_METRICS and rank <= 30:
            cautions.append({**insight, "summary": "비교 상권 가운데 이 수치가 하위 30%예요. 이유와 실제 현장 수요를 확인해 보세요."})
        elif key == "closing_rate" and rank >= 70:
            cautions.append({**insight, "summary": "폐업률이 비교 상권의 상위 30%예요. 가게 교체와 빈 점포 흐름을 현장에서 확인해 보세요."})
        elif key == "closing_rate" and rank <= 30:
            strengths.append({**insight, "summary": "폐업률이 비교 상권의 하위 30%예요. 다만 이 숫자만으로 안정적인 상권이라고 판단할 수는 없어요."})
        elif key in CONTEXT_METRICS and (rank >= 70 or rank <= 30):
            position = "높은" if rank >= 70 else "낮은"
            characteristics.append({**insight, "summary": f"비교 상권에서 이 수치는 {position} 편이에요. 좋고 나쁨보다 이 지역의 특징으로 봐 주세요."})

    return {
        "area": target,
        "comparison_count": len(records),
        "strengths": sorted(strengths, key=lambda item: item["percentile"], reverse=True),
        "cautions": sorted(cautions, key=lambda item: item["percentile"]),
        "characteristics": sorted(characteristics, key=lambda item: abs(item["percentile"] - 50), reverse=True)[:3],
    }
