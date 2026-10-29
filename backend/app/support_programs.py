from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal


MatchState = Literal["matched", "not_matched", "needs_confirmation"]


@dataclass(frozen=True)
class SupportProfile:
    stage: Literal["pre_startup", "existing"]
    region: str
    age: int | None = None
    years_in_business: int | None = None


@dataclass(frozen=True)
class NormalizedProgram:
    program_id: str
    title: str
    application_start: date
    application_end: date
    regions: tuple[str, ...]
    stages: tuple[str, ...]
    minimum_age: int | None = None
    maximum_age: int | None = None
    maximum_years_in_business: int | None = None
    source_url: str = ""


@dataclass(frozen=True)
class EligibilityCheck:
    field: str
    state: MatchState
    explanation: str


def evaluate_program(
    program: NormalizedProgram,
    profile: SupportProfile,
    *,
    today: date,
) -> list[EligibilityCheck]:
    checks: list[EligibilityCheck] = []

    checks.append(
        EligibilityCheck(
            field="application_period",
            state="matched" if program.application_start <= today <= program.application_end else "not_matched",
            explanation=(
                "현재 모집 기간입니다."
                if program.application_start <= today <= program.application_end
                else "현재 모집 기간이 아닙니다."
            ),
        )
    )
    region_matched = "전국" in program.regions or profile.region in program.regions
    checks.append(
        EligibilityCheck(
            field="region",
            state="matched" if region_matched else "not_matched",
            explanation="지역 조건과 일치합니다." if region_matched else "지역 조건과 일치하지 않습니다.",
        )
    )
    stage_matched = profile.stage in program.stages
    checks.append(
        EligibilityCheck(
            field="stage",
            state="matched" if stage_matched else "not_matched",
            explanation="창업 단계 조건과 일치합니다." if stage_matched else "창업 단계 조건과 일치하지 않습니다.",
        )
    )

    if program.minimum_age is None and program.maximum_age is None:
        checks.append(EligibilityCheck("age", "matched", "공고에 연령 제한이 없습니다."))
    elif profile.age is None:
        checks.append(EligibilityCheck("age", "needs_confirmation", "연령 조건은 사용자가 확인해야 합니다."))
    else:
        minimum = program.minimum_age if program.minimum_age is not None else 0
        maximum = program.maximum_age if program.maximum_age is not None else 200
        matched = minimum <= profile.age <= maximum
        checks.append(
            EligibilityCheck(
                "age",
                "matched" if matched else "not_matched",
                "연령 조건과 일치합니다." if matched else "연령 조건과 일치하지 않습니다.",
            )
        )

    if program.maximum_years_in_business is not None and profile.stage == "existing":
        if profile.years_in_business is None:
            checks.append(EligibilityCheck("business_age", "needs_confirmation", "업력 조건은 사용자가 확인해야 합니다."))
        else:
            matched = profile.years_in_business <= program.maximum_years_in_business
            checks.append(
                EligibilityCheck(
                    "business_age",
                    "matched" if matched else "not_matched",
                    "업력 조건과 일치합니다." if matched else "업력 상한을 초과합니다.",
                )
            )
    return checks


def is_candidate(checks: list[EligibilityCheck]) -> bool:
    return all(check.state != "not_matched" for check in checks)
