from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from .metric_service import get_all_area_metrics
from .models import TradeArea


@dataclass(frozen=True)
class PreferenceRule:
    metric_key: str
    weight: float
    direction: int = 1


@dataclass(frozen=True)
class CandidateScore:
    area: TradeArea
    score: float
    components: list[dict]
    available_count: int = 14


DEMAND_RULES = {
    "neighborhood": [PreferenceRule("total_population", 3), PreferenceRule("population_00_06_ratio", 2), PreferenceRule("weekend_sales_ratio", 2)],
    "office": [PreferenceRule("weekday_sales_ratio", 3), PreferenceRule("population_11_14_ratio", 3), PreferenceRule("sales_amount", 2)],
    "destination": [PreferenceRule("weekend_sales_ratio", 3), PreferenceRule("average_payment", 2), PreferenceRule("sales_amount", 2)],
    "nightlife": [PreferenceRule("population_17_21_ratio", 3), PreferenceRule("population_21_24_ratio", 3), PreferenceRule("weekend_sales_ratio", 2)],
}

RISK_RULES = {
    "lean": [PreferenceRule("closing_rate", 2, -1), PreferenceRule("store_count", 2, -1)],
    "balanced": [PreferenceRule("closing_rate", 1, -1), PreferenceRule("sales_amount", 1)],
    "growth": [PreferenceRule("sales_amount", 2), PreferenceRule("opening_rate", 1), PreferenceRule("total_population", 1)],
    "unknown": [],
}

COMPETITION_RULES = {
    "avoid": [PreferenceRule("store_count", 3, -1), PreferenceRule("closing_rate", 1, -1)],
    "validated": [PreferenceRule("store_count", 1), PreferenceRule("sales_amount", 2)],
    "differentiate": [PreferenceRule("average_payment", 1), PreferenceRule("weekend_sales_ratio", 1)],
    "traffic": [PreferenceRule("total_population", 3)],
}


def percentile(value: float, values: list[float]) -> float:
    if len(values) <= 1:
        return 50.0
    ordered = sorted(values)
    positions = [index for index, item in enumerate(ordered) if item == value]
    rank = sum(positions) / len(positions)
    return round(rank / (len(ordered) - 1) * 100, 1)


def combined_rules(demand: str, risk: str, competition: str) -> list[PreferenceRule]:
    grouped: dict[tuple[str, int], float] = {}
    for rule in DEMAND_RULES[demand] + RISK_RULES[risk] + COMPETITION_RULES[competition]:
        key = (rule.metric_key, rule.direction)
        grouped[key] = grouped.get(key, 0) + rule.weight
    return [PreferenceRule(metric_key, weight, direction) for (metric_key, direction), weight in grouped.items()]


def recommend(session: Session, *, demand: str, risk: str, competition: str, quarter: str = "20254", industry: str = "CS100010") -> list[CandidateScore]:
    rules = combined_rules(demand, risk, competition)
    records: list[tuple[TradeArea, dict[str, tuple[str, str, float]]]] = []
    for area, metrics in get_all_area_metrics(session, quarter, industry):
        available = {
            metric.metric_key: (metric.label, metric.unit, float(metric.value))
            for metric in metrics
            if metric.status == "available" and metric.value is not None
        }
        if "store_count" in available and "total_population" in available:
            records.append((area, available))

    if len(records) < 3:
        return []
    # Every scored area must use the same set of criteria. Missing sales never becomes zero.
    if any("sales_amount" in metrics for _, metrics in records):
        records = [(area, metrics) for area, metrics in records if all(rule.metric_key in metrics for rule in rules)]
        if len(records) < 3:
            return []
    common = set.intersection(*(set(metrics) for _, metrics in records))
    rules = [rule for rule in rules if rule.metric_key in common]
    if len(rules) < 2:
        rules.extend(rule for rule in (
            PreferenceRule("store_count", 1, -1), PreferenceRule("total_population", 1),
        ) if rule.metric_key in common and rule.metric_key not in {item.metric_key for item in rules})
    if len(rules) < 2:
        return []

    populations = {
        rule.metric_key: [metrics[rule.metric_key][2] for _, metrics in records]
        for rule in rules
    }
    total_weight = sum(rule.weight for rule in rules) or 1
    scored: list[CandidateScore] = []
    for area, metrics in records:
        components = []
        weighted_total = Decimal("0")
        for rule in rules:
            label, unit, value = metrics[rule.metric_key]
            raw_percentile = percentile(value, populations[rule.metric_key])
            fit_percentile = raw_percentile if rule.direction == 1 else 100 - raw_percentile
            weighted_total += Decimal(str(fit_percentile * rule.weight))
            components.append({
                "metric_key": rule.metric_key,
                "label": label,
                "unit": unit,
                "value": value,
                "percentile": raw_percentile,
                "fit_percentile": round(fit_percentile, 1),
                "weight": rule.weight,
                "direction": "higher" if rule.direction == 1 else "lower",
            })
        scored.append(CandidateScore(area, round(float(weighted_total) / total_weight, 1), components, len(metrics)))
    return sorted(scored, key=lambda candidate: (-candidate.score, candidate.area.code))


def select_diverse(candidates: list[CandidateScore], count: int = 3) -> list[CandidateScore]:
    selected: list[CandidateScore] = []
    remaining = candidates.copy()
    while remaining and len(selected) < count:
        districts = {item.area.district_name for item in selected}
        area_types = {item.area.area_type_name for item in selected}
        best = max(
            remaining,
            key=lambda item: (
                item.score
                + (2 if selected and item.area.district_name not in districts else 0)
                + (1 if selected and item.area.area_type_name not in area_types else 0),
                item.score,
                item.area.code,
            ),
        )
        selected.append(best)
        remaining.remove(best)
    return selected
