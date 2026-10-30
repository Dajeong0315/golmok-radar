from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal


KSTARTUP_API_URL = (
    "https://apis.data.go.kr/B552735/kisedKstartupService01/"
    "getAnnouncementInformation01"
)
KSTARTUP_PORTAL_URL = "https://www.k-startup.go.kr/"
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
    support_type: str = ""
    target_text: str = ""
    region_text: str = ""
    business_age_text: str = ""
    age_text: str = ""
    unparsed_conditions: tuple[str, ...] = ()


@dataclass(frozen=True)
class EligibilityCheck:
    field: str
    state: MatchState
    explanation: str


def _parse_date(value: Any) -> date:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) < 8:
        raise ValueError(f"날짜 형식이 올바르지 않습니다: {value!r}")
    return date(int(digits[:4]), int(digits[4:6]), int(digits[6:8]))


def _normalize_regions(value: str) -> tuple[str, ...]:
    if "전국" in value:
        return ("전국",)
    aliases = {
        "서울": "서울", "부산": "부산", "대구": "대구", "인천": "인천",
        "광주": "광주", "대전": "대전", "울산": "울산", "세종": "세종",
        "경기": "경기", "강원": "강원", "충북": "충북", "충남": "충남",
        "전북": "전북", "전남": "전남", "경북": "경북", "경남": "경남", "제주": "제주",
    }
    return tuple(name for token, name in aliases.items() if token in value)


def _normalize_stages(business_age: str, target: str) -> tuple[tuple[str, ...], int | None]:
    combined = f"{business_age} {target}"
    stages: list[str] = []
    if "예비" in combined:
        stages.append("pre_startup")
    years = [int(value) for value in re.findall(r"(\d+)\s*년\s*(?:미만|이내)", business_age)]
    if years or any(word in combined for word in ("기창업", "창업기업", "사업자")):
        stages.append("existing")
    maximum = max(years) if years else None
    if "미만" in business_age and maximum is not None:
        maximum -= 1
    return tuple(dict.fromkeys(stages)), maximum


def _normalize_age(value: str) -> tuple[int | None, int | None, bool]:
    normalized = value.replace(" ", "")
    if not normalized or any(word in normalized for word in ("제한없음", "무관", "전체")):
        return None, None, True
    ranges: list[tuple[int, int]] = []
    for low, high in re.findall(r"만?(\d+)세이상(?:~|∼|-)만?(\d+)세이하", normalized):
        ranges.append((int(low), int(high)))
    for high in re.findall(r"만?(\d+)세미만", normalized):
        ranges.append((0, int(high) - 1))
    for low in re.findall(r"만?(\d+)세이상(?!~|∼|-)", normalized):
        ranges.append((int(low), 200))
    if not ranges:
        return None, None, False
    minimum = min(item[0] for item in ranges)
    maximum = max(item[1] for item in ranges)
    return (None if minimum == 0 else minimum), (None if maximum == 200 else maximum), True


def normalize_program(row: dict[str, Any]) -> NormalizedProgram:
    program_id = str(row.get("pbanc_sn") or "").strip()
    title = str(row.get("biz_pbanc_nm") or row.get("intg_pbanc_biz_nm") or "").strip()
    if not program_id or not title:
        raise ValueError("공고일련번호 또는 공고명이 없습니다.")

    region_text = str(row.get("supt_regin") or "").strip()
    business_age_text = str(row.get("biz_enyy") or "").strip()
    age_text = str(row.get("biz_trgt_age") or "").strip()
    target_text = " ".join(
        value for value in (
            str(row.get("aply_trgt") or "").strip(),
            str(row.get("aply_trgt_ctnt") or "").strip(),
        ) if value
    )
    regions = _normalize_regions(region_text)
    stages, maximum_years = _normalize_stages(business_age_text, target_text)
    minimum_age, maximum_age, age_parsed = _normalize_age(age_text)
    unparsed: list[str] = []
    if region_text and not regions:
        unparsed.append("region")
    if business_age_text and not stages:
        unparsed.append("stage")
    if age_text and not age_parsed:
        unparsed.append("age")

    source_url = next((
        str(row.get(key) or "").strip()
        for key in ("biz_aply_url", "detl_pg_url", "biz_gdnc_url")
        if str(row.get(key) or "").strip().startswith(("http://", "https://"))
    ), KSTARTUP_PORTAL_URL)
    return NormalizedProgram(
        program_id=program_id,
        title=title,
        application_start=_parse_date(row.get("pbanc_rcpt_bgng_dt")),
        application_end=_parse_date(row.get("pbanc_rcpt_end_dt")),
        regions=regions,
        stages=stages,
        minimum_age=minimum_age,
        maximum_age=maximum_age,
        maximum_years_in_business=maximum_years,
        source_url=source_url,
        support_type=str(row.get("supt_biz_clsfc") or "").strip(),
        target_text=target_text,
        region_text=region_text,
        business_age_text=business_age_text,
        age_text=age_text,
        unparsed_conditions=tuple(unparsed),
    )


def response_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    error = payload.get("RESULT") or payload.get("result")
    if isinstance(error, dict) and str(error.get("CODE") or error.get("code") or "").startswith("ERROR"):
        raise ValueError(str(error.get("MESSAGE") or error.get("message") or "K-Startup API 오류"))
    data = payload.get("data")
    if isinstance(data, dict):
        data = data.get("data")
    if not isinstance(data, list):
        raise ValueError("K-Startup 응답에서 data 배열을 찾지 못했습니다.")
    return [row for row in data if isinstance(row, dict)]


def fetch_page(key: str, *, page: int = 1, per_page: int = 100) -> bytes:
    query = urllib.parse.urlencode({
        "serviceKey": key,
        "page": page,
        "perPage": per_page,
        "cond[rcrt_prgs_yn::EQ]": "Y",
        "returnType": "json",
    }, safe="%")
    request = urllib.request.Request(f"{KSTARTUP_API_URL}?{query}", headers={"User-Agent": "golmok-radar/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"K-Startup API가 HTTP {error.code}를 반환했습니다.") from error
    except urllib.error.URLError as error:
        raise RuntimeError("K-Startup API에 연결하지 못했습니다.") from error


def decode_response(raw: bytes) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        payload = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("K-Startup 응답이 JSON 형식이 아닙니다.") from error
    if not isinstance(payload, dict):
        raise ValueError("K-Startup 응답 최상위 형식이 객체가 아닙니다.")
    return payload, response_rows(payload)


def evaluate_program(program: NormalizedProgram, profile: SupportProfile, *, today: date) -> list[EligibilityCheck]:
    checks: list[EligibilityCheck] = []
    current = program.application_start <= today <= program.application_end
    checks.append(EligibilityCheck(
        "application_period", "matched" if current else "not_matched",
        "현재 모집 기간입니다." if current else "현재 모집 기간이 아닙니다.",
    ))
    if not program.regions or "region" in program.unparsed_conditions:
        checks.append(EligibilityCheck("region", "needs_confirmation", "공고 원문에서 지원 지역을 확인해야 합니다."))
    else:
        matched = "전국" in program.regions or profile.region in program.regions
        checks.append(EligibilityCheck(
            "region", "matched" if matched else "not_matched",
            "지역 조건과 일치합니다." if matched else "지역 조건과 일치하지 않습니다.",
        ))
    if not program.stages or "stage" in program.unparsed_conditions:
        checks.append(EligibilityCheck("stage", "needs_confirmation", "공고 원문에서 창업 단계 조건을 확인해야 합니다."))
    else:
        matched = profile.stage in program.stages
        checks.append(EligibilityCheck(
            "stage", "matched" if matched else "not_matched",
            "창업 단계 조건과 일치합니다." if matched else "창업 단계 조건과 일치하지 않습니다.",
        ))
    if "age" in program.unparsed_conditions:
        checks.append(EligibilityCheck("age", "needs_confirmation", "공고 원문에서 연령 조건을 확인해야 합니다."))
    elif program.minimum_age is None and program.maximum_age is None:
        checks.append(EligibilityCheck("age", "matched", "공고의 구조화된 연령 제한이 없습니다."))
    elif profile.age is None:
        checks.append(EligibilityCheck("age", "needs_confirmation", "연령 조건은 사용자가 확인해야 합니다."))
    else:
        minimum = program.minimum_age if program.minimum_age is not None else 0
        maximum = program.maximum_age if program.maximum_age is not None else 200
        matched = minimum <= profile.age <= maximum
        checks.append(EligibilityCheck(
            "age", "matched" if matched else "not_matched",
            "연령 조건과 일치합니다." if matched else "연령 조건과 일치하지 않습니다.",
        ))
    if program.maximum_years_in_business is not None and profile.stage == "existing":
        if profile.years_in_business is None:
            checks.append(EligibilityCheck("business_age", "needs_confirmation", "업력 조건은 사용자가 확인해야 합니다."))
        else:
            matched = profile.years_in_business <= program.maximum_years_in_business
            checks.append(EligibilityCheck(
                "business_age", "matched" if matched else "not_matched",
                "업력 조건과 일치합니다." if matched else "업력 상한을 초과합니다.",
            ))
    if program.target_text:
        checks.append(EligibilityCheck("target_detail", "needs_confirmation", "신청 대상의 상세·제외 조건은 공고 원문에서 확인해야 합니다."))
    return checks


def is_candidate(checks: list[EligibilityCheck]) -> bool:
    return all(check.state != "not_matched" for check in checks)


def select_candidates(
    programs: list[NormalizedProgram], profile: SupportProfile, *, today: date, limit: int = 2
) -> list[tuple[NormalizedProgram, list[EligibilityCheck]]]:
    evaluated = [(program, evaluate_program(program, profile, today=today)) for program in programs]
    candidates = [(program, checks) for program, checks in evaluated if is_candidate(checks)]
    candidates.sort(key=lambda item: (
        sum(check.state == "needs_confirmation" for check in item[1]),
        item[0].application_end,
        item[0].title,
    ))
    return candidates[:limit]
