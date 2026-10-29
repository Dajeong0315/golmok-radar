from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP


@dataclass(frozen=True)
class CalculationResult:
    status: str
    value: Decimal | int | None
    reason: str | None
    formula: str
    numerator: int | None
    denominator: int | None


def _unavailable(
    formula: str,
    numerator: int | None,
    denominator: int | None,
    reason: str,
) -> CalculationResult:
    return CalculationResult(
        status="unavailable",
        value=None,
        reason=reason,
        formula=formula,
        numerator=numerator,
        denominator=denominator,
    )


def percentage(
    numerator: int | None,
    denominator: int | None,
    *,
    formula: str,
) -> CalculationResult:
    if numerator is None or denominator is None:
        return _unavailable(formula, numerator, denominator, "계산에 필요한 원천값이 없습니다.")
    if denominator == 0:
        return _unavailable(formula, numerator, denominator, "분모가 0이어서 계산할 수 없습니다.")

    value = (Decimal(numerator) * Decimal(100) / Decimal(denominator)).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )
    return CalculationResult("available", value, None, formula, numerator, denominator)


def weekend_sales_ratio(weekend_sales: int | None, total_sales: int | None) -> CalculationResult:
    return percentage(
        weekend_sales,
        total_sales,
        formula="주말 매출 금액 ÷ 전체 매출 금액 × 100",
    )


def weekday_sales_ratio(weekday_sales: int | None, total_sales: int | None) -> CalculationResult:
    return percentage(
        weekday_sales,
        total_sales,
        formula="주중 매출 금액 ÷ 전체 매출 금액 × 100",
    )


def average_payment(sales_amount: int | None, sales_count: int | None) -> CalculationResult:
    formula = "전체 매출 금액 ÷ 전체 매출 건수"
    if sales_amount is None or sales_count is None:
        return _unavailable(formula, sales_amount, sales_count, "계산에 필요한 원천값이 없습니다.")
    if sales_count == 0:
        return _unavailable(formula, sales_amount, sales_count, "매출 건수가 0이어서 계산할 수 없습니다.")

    value = int(
        (Decimal(sales_amount) / Decimal(sales_count)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )
    return CalculationResult("available", value, None, formula, sales_amount, sales_count)


def time_slot_ratio(slot_population: int | None, total_population: int | None) -> CalculationResult:
    return percentage(
        slot_population,
        total_population,
        formula="시간대 유동인구 ÷ 총 유동인구 × 100",
    )

