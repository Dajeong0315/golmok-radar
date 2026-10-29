from decimal import Decimal

import pytest

from app.calculations import (
    average_payment,
    time_slot_ratio,
    weekday_sales_ratio,
    weekend_sales_ratio,
)


@pytest.mark.parametrize(
    ("calculator", "numerator", "denominator", "expected"),
    [
        (weekend_sales_ratio, 300, 1_000, Decimal("30.0")),
        (weekday_sales_ratio, 2, 3, Decimal("66.7")),
        (time_slot_ratio, 1, 8, Decimal("12.5")),
        (weekend_sales_ratio, 0, 100, Decimal("0.0")),
    ],
)
def test_percentage_calculations(calculator, numerator, denominator, expected) -> None:
    result = calculator(numerator, denominator)

    assert result.status == "available"
    assert result.value == expected
    assert result.reason is None


def test_average_payment_rounds_half_up_to_won() -> None:
    result = average_payment(105, 2)

    assert result.status == "available"
    assert result.value == 53


@pytest.mark.parametrize(
    ("numerator", "denominator", "reason"),
    [
        (100, 0, "분모가 0"),
        (None, 100, "원천값이 없습니다"),
    ],
)
def test_percentage_unavailable_cases(numerator, denominator, reason) -> None:
    result = weekend_sales_ratio(numerator, denominator)

    assert result.status == "unavailable"
    assert result.value is None
    assert reason in result.reason


def test_average_payment_handles_large_amount_without_float_loss() -> None:
    result = average_payment(9_999_999_999, 1)

    assert result.value == 9_999_999_999

