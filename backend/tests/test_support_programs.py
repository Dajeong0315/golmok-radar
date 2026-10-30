import json
from datetime import date

import pytest

from app.support_programs import (
    NormalizedProgram,
    SupportProfile,
    evaluate_program,
    is_candidate,
    normalize_program,
    response_rows,
    select_candidates,
)


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


def test_official_row_is_normalized_without_guessing_unstructured_target() -> None:
    program = normalize_program({
        "pbanc_sn": "2026-001",
        "biz_pbanc_nm": "서울 예비창업 지원",
        "pbanc_rcpt_bgng_dt": "20261001",
        "pbanc_rcpt_end_dt": "20261031",
        "supt_regin": "서울특별시",
        "biz_enyy": "예비창업자",
        "biz_trgt_age": "만 20세 이상 ~ 만 39세 이하",
        "aply_trgt": "일반인",
        "aply_trgt_ctnt": "세부 제외 조건은 공고문 참고",
        "supt_biz_clsfc": "사업화",
        "biz_aply_url": "https://www.k-startup.go.kr/example",
    })
    assert program.regions == ("서울",)
    assert program.stages == ("pre_startup",)
    assert (program.minimum_age, program.maximum_age) == (20, 39)
    checks = evaluate_program(
        program, SupportProfile(stage="pre_startup", region="서울", age=30), today=date(2026, 10, 29)
    )
    assert next(check for check in checks if check.field == "target_detail").state == "needs_confirmation"


def test_response_contract_accepts_documented_shapes_and_rejects_missing_data() -> None:
    row = {"pbanc_sn": "1"}
    assert response_rows({"data": [row]}) == [row]
    assert response_rows({"data": {"data": [row]}}) == [row]
    with pytest.raises(ValueError, match="data 배열"):
        response_rows({"currentCount": 0})


def test_selection_returns_at_most_two_current_non_conflicting_candidates() -> None:
    programs = [
        fixture_program(program_id=f"fixture-{index}", title=f"후보 {index}")
        for index in range(3)
    ] + [fixture_program(program_id="expired", application_end=date(2026, 9, 30))]
    selected = select_candidates(
        programs, SupportProfile(stage="pre_startup", region="서울", age=31), today=date(2026, 10, 29)
    )
    assert [program.program_id for program, _ in selected] == ["fixture-0", "fixture-1"]


def test_kstartup_loader_preserves_normalized_contract(tmp_path, monkeypatch) -> None:
    from database.scripts import load_kstartup

    raw_dir = tmp_path / "kstartup"
    raw_dir.mkdir()
    raw_name = "kstartup_announcements_20261030_p001.json"
    payload = {"data": [{
        "pbanc_sn": "loader-1",
        "biz_pbanc_nm": "적재 검증 공고",
        "pbanc_rcpt_bgng_dt": "20261001",
        "pbanc_rcpt_end_dt": "20261031",
        "supt_regin": "전국",
        "biz_enyy": "예비창업자",
        "biz_trgt_age": "제한없음",
        "supt_biz_clsfc": "멘토링",
        "detl_pg_url": "https://www.k-startup.go.kr/loader-1",
    }]}
    (raw_dir / raw_name).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    meta_path = raw_dir / "kstartup_announcements_20261030.meta.json"
    meta_path.write_text(json.dumps({
        "dataset": "K-Startup 지원사업 공고 정보",
        "provider": "창업진흥원",
        "fetched_at": "2026-10-30T12:00:00",
        "pages": [{"page": 1, "file": raw_name, "rows": 1}],
    }, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(load_kstartup, "RAW_DIR", raw_dir)
    programs, source = load_kstartup.collect_rows(meta_path)
    assert len(programs) == 1
    assert programs[0].regions == ["전국"]
    assert programs[0].stages == ["pre_startup"]
    assert source.source_file == meta_path.name
