"""엑셀 손계산 기준표(docs/지표_손계산_기준표.xlsx)와 백엔드 계산 결과를 대조한다.

AGENTS.md 데이터 규칙: 계산식은 엑셀 손계산 기준표와 pytest 결과가 일치해야 한다.
기준표의 `pytest 기대값`(F열)을 손계산 값으로 보고, 같은 분자·분모를 계산 함수에 넣어 비교한다.
"""

from decimal import Decimal
from pathlib import Path

import pytest

from app.calculations import average_payment, time_slot_ratio, time_slot_sales_ratio, weekday_sales_ratio, weekend_sales_ratio

openpyxl = pytest.importorskip("openpyxl")

WORKBOOK = Path(__file__).resolve().parents[2] / "docs" / "지표_손계산_기준표.xlsx"


def calculator(label: str):
    if label.startswith("주말 매출 비중"):
        return weekend_sales_ratio
    if label.startswith("주중 매출 비중"):
        return weekday_sales_ratio
    if label.startswith("시간대 유동인구 비중"):
        return time_slot_ratio
    if label.startswith("건당 평균 결제액"):
        return average_payment
    if "시 매출 비중" in label:
        return time_slot_sales_ratio
    raise AssertionError(f"기준표 지표에 대응하는 계산 함수가 없습니다: {label}")


def cases() -> list[tuple[str, int, str, int | None, int | None, object]]:
    workbook = openpyxl.load_workbook(WORKBOOK)
    rows = []
    for sheet in workbook.worksheets:
        header = [cell.value for cell in sheet[5]]
        assert header[:7] == ["유형", "지표", "분자", "분모", "엑셀 계산 결과", "pytest 기대값", "판정"], sheet.title
        for row in sheet.iter_rows(min_row=6):
            kind, label, numerator, denominator, _formula, expected = (cell.value for cell in row[:6])
            if not kind or not label:
                break
            rows.append((sheet.title, row[0].row, label, numerator, denominator, expected))
    return rows


def test_workbook_has_time_slot_sales_cases() -> None:
    labels = [label for _, _, label, *_ in cases()]
    assert sum("매출 비중" in label and "시" in label for label in labels) >= 6
    assert len(labels) >= 16


@pytest.mark.parametrize(("sheet", "row", "label", "numerator", "denominator", "expected"), cases())
def test_backend_matches_hand_calculation(sheet, row, label, numerator, denominator, expected) -> None:
    result = calculator(label)(numerator, denominator)
    if expected == "비교 불가":
        assert result.status == "unavailable", f"{sheet}!{row}"
        assert result.value is None
    else:
        assert result.status == "available", f"{sheet}!{row}"
        assert Decimal(str(result.value)) == Decimal(str(expected)), f"{sheet}!{row}: {result.value} != {expected}"
