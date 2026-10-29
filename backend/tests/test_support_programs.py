from datetime import date

from app.support_programs import NormalizedProgram, SupportProfile, evaluate_program, is_candidate


def fixture_program(**overrides) -> NormalizedProgram:
    values = {
        "program_id": "fixture-1",
        "title": "계약 검증용 fixture",
        "application_start": date(2026, 10, 1),
        "application_end": date(2026, 10, 31),
        "regions": ("서울",),
        "stages": ("pre_startup",),
        "minimum_age": 19,
        "maximum_age": 39,
        "source_url": "https://example.invalid/fixture",
    }
    values.update(overrides)
    return NormalizedProgram(**values)


def test_eligibility_matches_period_region_stage_and_age() -> None:
    checks = evaluate_program(
        fixture_program(),
        SupportProfile(stage="pre_startup", region="서울", age=31),
        today=date(2026, 10, 29),
    )
    assert is_candidate(checks)
    assert {check.state for check in checks} == {"matched"}


def test_expired_or_wrong_region_is_not_a_candidate() -> None:
    checks = evaluate_program(
        fixture_program(application_end=date(2026, 9, 30)),
        SupportProfile(stage="pre_startup", region="부산", age=31),
        today=date(2026, 10, 29),
    )
    assert not is_candidate(checks)
    assert [check.field for check in checks if check.state == "not_matched"] == ["application_period", "region"]


def test_unknown_age_is_exposed_as_needs_confirmation() -> None:
    checks = evaluate_program(
        fixture_program(),
        SupportProfile(stage="pre_startup", region="서울"),
        today=date(2026, 10, 29),
    )
    age = next(check for check in checks if check.field == "age")
    assert age.state == "needs_confirmation"
    assert is_candidate(checks)
