from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from .calculations import (
    CalculationResult,
    average_payment,
    time_slot_ratio,
    weekday_sales_ratio,
    weekend_sales_ratio,
)
from .models import PopulationMetric, SalesMetric, StoreMetric, TradeArea


@dataclass(frozen=True)
class MetricValue:
    metric_key: str
    label: str
    unit: str
    status: str
    value: int | float | Decimal | None
    reason: str | None = None
    calculation: CalculationResult | None = None


def raw_metric(
    metric_key: str,
    label: str,
    unit: str,
    value: int | float | None,
    *,
    missing_reason: str,
) -> MetricValue:
    if value is None:
        return MetricValue(metric_key, label, unit, "unavailable", None, missing_reason)
    return MetricValue(metric_key, label, unit, "available", value)


def calculated_metric(
    metric_key: str,
    label: str,
    unit: str,
    result: CalculationResult,
) -> MetricValue:
    return MetricValue(
        metric_key=metric_key,
        label=label,
        unit=unit,
        status=result.status,
        value=result.value,
        reason=result.reason,
        calculation=result,
    )


def get_area_metrics(
    session: Session,
    trade_area_code: str,
    quarter_code: str,
    industry_code: str = "CS100010",
) -> tuple[TradeArea | None, list[MetricValue]]:
    area = session.get(TradeArea, trade_area_code)
    store = session.get(StoreMetric, (quarter_code, trade_area_code, industry_code))
    sales = session.get(SalesMetric, (quarter_code, trade_area_code, industry_code))
    population = session.get(PopulationMetric, (quarter_code, trade_area_code))

    store_reason = "해당 분기·업종의 점포 원천 행이 없습니다."
    sales_reason = "해당 분기·업종의 매출 원천 행이 없습니다."
    population_reason = "해당 분기의 유동인구 원천 행이 없습니다."

    metrics = [
        raw_metric(
            "store_count",
            "카페 점포 수",
            "개",
            store.store_count if store else None,
            missing_reason=store_reason,
        ),
        raw_metric(
            "opening_rate",
            "개업률",
            "%",
            store.opening_rate if store else None,
            missing_reason=store_reason,
        ),
        raw_metric(
            "closing_rate",
            "폐업률",
            "%",
            store.closing_rate if store else None,
            missing_reason=store_reason,
        ),
        raw_metric(
            "total_population",
            "추정 유동인구",
            "명",
            population.total_population if population else None,
            missing_reason=population_reason,
        ),
        raw_metric(
            "sales_amount",
            "카페 추정매출",
            "원",
            sales.sales_amount if sales else None,
            missing_reason=sales_reason,
        ),
        calculated_metric(
            "weekday_sales_ratio",
            "주중 매출 비중",
            "%",
            weekday_sales_ratio(
                sales.weekday_sales_amount if sales else None,
                sales.sales_amount if sales else None,
            ),
        ),
        calculated_metric(
            "weekend_sales_ratio",
            "주말 매출 비중",
            "%",
            weekend_sales_ratio(
                sales.weekend_sales_amount if sales else None,
                sales.sales_amount if sales else None,
            ),
        ),
        calculated_metric(
            "average_payment",
            "건당 평균 결제액",
            "원",
            average_payment(
                sales.sales_amount if sales else None,
                sales.sales_count if sales else None,
            ),
        ),
    ]

    time_slots = (
        [
            ("00_06", population.population_00_06),
            ("06_11", population.population_06_11),
            ("11_14", population.population_11_14),
            ("14_17", population.population_14_17),
            ("17_21", population.population_17_21),
            ("21_24", population.population_21_24),
        ]
        if population
        else [(key, None) for key in ("00_06", "06_11", "11_14", "14_17", "17_21", "21_24")]
    )
    for key, value in time_slots:
        metrics.append(
            calculated_metric(
                f"population_{key}_ratio",
                f"{key.replace('_', '~')}시 유동인구 비중",
                "%",
                time_slot_ratio(value, population.total_population if population else None),
            )
        )
    return area, metrics

