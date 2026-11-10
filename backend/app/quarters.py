"""기준분기 선택 규칙 (Phase 40).

서비스가 보여 줄 수 있는 기준분기는 DB에 점포 원천이 적재된 분기다.
기본값은 적재된 가장 최근 분기이며, `DEFAULT_QUARTER` 환경 변수로 고정할 수 있다.
비교·근거·리포트는 요청한 한 분기의 원천만 사용하고 분기를 섞지 않는다.
"""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import StoreMetric

FALLBACK_QUARTER = "20254"


def is_quarter_code(value: str) -> bool:
    return len(value) == 5 and value.isdigit() and value[4] in "1234"


def quarter_label(code: str) -> str:
    return f"{code[:4]}년 {code[4]}분기"


def available_quarters(session: Session) -> list[str]:
    """점포 원천이 적재된 분기를 최신순으로 돌려준다."""
    codes = session.scalars(select(StoreMetric.quarter_code).distinct()).all()
    return sorted((code for code in codes if is_quarter_code(code)), reverse=True)


def default_quarter(session: Session, available: list[str] | None = None) -> str:
    available = available if available is not None else available_quarters(session)
    configured = get_settings().default_quarter
    if configured and configured in available:
        return configured
    return available[0] if available else FALLBACK_QUARTER


def resolve_quarter(session: Session, quarter: str | None) -> str:
    """요청 분기를 검증한다. 없으면 기본 분기를 쓴다."""
    available = available_quarters(session)
    if quarter is None or quarter == "":
        return default_quarter(session, available)
    if quarter not in available:
        raise HTTPException(400, "지원하지 않는 기준분기입니다.")
    return quarter
