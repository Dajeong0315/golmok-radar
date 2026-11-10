"""원천 데이터 품질 검사·갱신 파이프라인 (Phase 39).

기본 실행은 읽기와 검사만 한다. 운영 DB는 바꾸지 않는다.

    python database/scripts/data_quality.py --quarter 20254

검사를 모두 통과했을 때만 지정한 DB에 반영한다.

    python database/scripts/data_quality.py --quarter 20254 --apply --database-url <URL>

단계: 원천 파일 확인(매니페스트) → 컬럼 검사 → 품질 검사 → 임시 SQLite 적재
→ 표본 지표 재계산 대조 → 검증 리포트(JSON·Markdown) 저장.
리포트는 Git 제외 경로 `database/processed/data_quality/`에 저장한다.
오류가 하나라도 있으면 종료 코드 1을 돌려주고 반영 단계로 가지 않는다.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Callable, Iterable


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from database.scripts.raw_sources import (  # noqa: E402
    POPULATION_FORMATS,
    SALES_FORMATS,
    STORE_FORMATS,
    TIME_SLOTS,
    FileManifest,
    detect_format,
    iter_csv,
    iter_zip_csv,
    normalize,
)

DEFAULT_OUTPUT = ROOT / "database" / "processed" / "data_quality"
EXAMPLE_LIMIT = 5
ROW_CHANGE_WARNING = 0.10  # 이전 분기 대비 행 수 변화 경고 기준(±10%)
SAMPLE_INDUSTRIES = ("CS100010", "CS100001", "CS200001")
POPULATION_SUM_TOLERANCE = len(TIME_SLOTS)


@dataclass
class Issue:
    level: str  # "error" | "warning"
    source: str
    check: str
    message: str
    count: int = 0
    examples: list[str] = field(default_factory=list)


@dataclass
class SourceResult:
    kind: str
    status: str  # "checked" | "missing"
    format: str | None = None
    rows_in_quarter: int = 0
    previous_quarter_rows: int | None = None
    industries: int | None = None
    areas: int | None = None


@dataclass
class QualityReport:
    quarter: str
    started_at: str
    files: list[FileManifest] = field(default_factory=list)
    sources: list[SourceResult] = field(default_factory=list)
    issues: list[Issue] = field(default_factory=list)
    trial_load: dict | None = None
    sample_checks: list[dict] = field(default_factory=list)
    applied: dict | None = None

    @property
    def errors(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.level == "error"]

    def to_dict(self) -> dict:
        data = asdict(self)
        data["passed"] = not self.errors
        data["error_count"] = len(self.errors)
        data["warning_count"] = len(self.issues) - len(self.errors)
        return data


class Collector:
    """같은 검사 위반을 하나로 모아 건수와 예시 몇 개만 남긴다."""

    def __init__(self, report: QualityReport, source: str) -> None:
        self.report = report
        self.source = source
        self.found: dict[tuple[str, str, str], Issue] = {}

    def add(self, level: str, check: str, message: str, example: str = "") -> None:
        key = (level, check, message)
        issue = self.found.get(key)
        if issue is None:
            issue = Issue(level, self.source, check, message)
            self.found[key] = issue
            self.report.issues.append(issue)
        issue.count += 1
        if example and len(issue.examples) < EXAMPLE_LIMIT:
            issue.examples.append(example)


def previous_quarter(quarter: str) -> str:
    year, number = int(quarter[:4]), int(quarter[4])
    return f"{year - 1}4" if number == 1 else f"{year}{number - 1}"


def valid_quarter(quarter: str) -> bool:
    return len(quarter) == 5 and quarter.isdigit() and quarter[4] in "1234"


def as_number(value: str) -> Decimal | None:
    if value == "":
        return None
    try:
        return Decimal(value)
    except Exception:
        return None


def ratio(numerator: int, denominator: int, digits: str = "0.1") -> Decimal | None:
    if denominator == 0:
        return None
    return (Decimal(numerator) * 100 / Decimal(denominator)).quantize(Decimal(digits), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------- 행 검사


def check_store_rows(rows: Iterable[dict[str, str]], quarter: str, area_codes: set[str] | None, collect: Collector) -> tuple[list[dict], Counter]:
    kept: list[dict] = []
    per_quarter: Counter = Counter()
    keys: set[tuple[str, str, str]] = set()
    names: dict[str, str] = {}
    for row in rows:
        per_quarter[row["quarter"]] += 1
        if row["quarter"] != quarter:
            continue
        key = (row["quarter"], row["area"], row["industry"])
        label = f"{row['area']}·{row['industry']}"
        for column in ("area", "industry", "industry_name", "store_count"):
            if row[column] == "":
                collect.add("error", "required_value", f"필수값 `{column}`이 비어 있습니다.", label)
        if key in keys:
            collect.add("error", "duplicate_key", "논리 키(quarter, trade_area, industry)가 중복됩니다.", label)
        keys.add(key)
        if area_codes is not None and row["area"] not in area_codes:
            collect.add("error", "unknown_area", "공식 상권 영역에 없는 상권 코드입니다.", row["area"])
        if row["industry"] in names and names[row["industry"]] != row["industry_name"]:
            collect.add("error", "industry_name", "같은 업종 코드에 업종명이 둘 이상입니다.", row["industry"])
        names.setdefault(row["industry"], row["industry_name"])
        count = as_number(row["store_count"])
        if row["store_count"] and (count is None or count < 0 or count != count.to_integral_value()):
            collect.add("error", "range", "점포 수가 0 이상의 정수가 아닙니다.", f"{label}={row['store_count']}")
        similar = as_number(row["similar_store_count"])
        for column, count_column in (("opening_rate", "opening_store_count"), ("closing_rate", "closing_store_count")):
            value = as_number(row[column])
            if row[column] and (value is None or value < 0):
                collect.add("error", "range", f"`{column}`이 0 이상의 숫자가 아닙니다.", f"{label}={row[column]}")
                continue
            # 원천 정의: 개·폐업 점포 수 ÷ 유사업종 점포 수 × 100 (100% 초과 가능, 정수 반올림 방식은 원천이 밝히지 않음)
            count = as_number(row[count_column])
            if value is not None and similar and count is not None and abs(value - count * 100 / similar) > 1:
                collect.add("warning", "rate_definition", f"`{column}`이 점포 수 ÷ 유사업종 점포 수 × 100과 1포인트 넘게 다릅니다.", f"{label}={row[column]}")
        kept.append(row)
    return kept, per_quarter


def check_sales_rows(rows: Iterable[dict[str, str]], quarter: str, area_codes: set[str] | None, collect: Collector) -> tuple[list[dict], Counter]:
    kept: list[dict] = []
    per_quarter: Counter = Counter()
    keys: set[tuple[str, str, str]] = set()
    names: dict[str, str] = {}
    amount_columns = ["sales_amount", "sales_count", "weekday_sales_amount", "weekend_sales_amount", *[f"sales_{slot}" for slot in TIME_SLOTS]]
    for row in rows:
        per_quarter[row["quarter"]] += 1
        if row["quarter"] != quarter:
            continue
        key = (row["quarter"], row["area"], row["industry"])
        label = f"{row['area']}·{row['industry']}"
        if key in keys:
            collect.add("error", "duplicate_key", "논리 키(quarter, trade_area, industry)가 중복됩니다.", label)
        keys.add(key)
        if area_codes is not None and row["area"] not in area_codes:
            collect.add("error", "unknown_area", "공식 상권 영역에 없는 상권 코드입니다.", row["area"])
        if row["industry"] in names and names[row["industry"]] != row["industry_name"]:
            collect.add("error", "industry_name", "같은 업종 코드에 업종명이 둘 이상입니다.", row["industry"])
        names.setdefault(row["industry"], row["industry_name"])
        values: dict[str, Decimal] = {}
        for column in amount_columns:
            value = as_number(row[column])
            if row[column] == "":
                collect.add("error", "required_value", f"필수값 `{column}`이 비어 있습니다.", label)
            elif value is None or value < 0:
                collect.add("error", "range", f"`{column}`이 0 이상의 숫자가 아닙니다.", f"{label}={row[column]}")
            else:
                values[column] = value
        if all(column in values for column in ("sales_amount", "weekday_sales_amount", "weekend_sales_amount")):
            if values["weekday_sales_amount"] + values["weekend_sales_amount"] != values["sales_amount"]:
                collect.add("error", "sum_mismatch", "주중 매출 + 주말 매출이 당월 매출과 다릅니다.", label)
        slot_columns = [f"sales_{slot}" for slot in TIME_SLOTS]
        if "sales_amount" in values and all(column in values for column in slot_columns):
            if sum(values[column] for column in slot_columns) != values["sales_amount"]:
                collect.add("error", "sum_mismatch", "시간대 매출 6개의 합이 당월 매출과 다릅니다.", label)
        kept.append(row)
    return kept, per_quarter


def check_population_rows(rows: Iterable[dict[str, str]], quarter: str, area_codes: set[str] | None, collect: Collector) -> tuple[list[dict], Counter]:
    kept: list[dict] = []
    per_quarter: Counter = Counter()
    keys: set[tuple[str, str]] = set()
    columns = ["total_population", *[f"population_{slot}" for slot in TIME_SLOTS]]
    for row in rows:
        per_quarter[row["quarter"]] += 1
        if row["quarter"] != quarter:
            continue
        key = (row["quarter"], row["area"])
        if key in keys:
            collect.add("error", "duplicate_key", "논리 키(quarter, trade_area)가 중복됩니다.", row["area"])
        keys.add(key)
        if area_codes is not None and row["area"] not in area_codes:
            # 유동인구 원천은 서울 밖·폐지 상권 행을 포함할 수 있어, 적재 때 공식 영역 안 행만 쓴다.
            collect.add("warning", "outside_area", "공식 상권 영역 밖 행이라 적재에서 제외됩니다.", row["area"])
            continue
        values: dict[str, Decimal] = {}
        for column in columns:
            value = as_number(row[column])
            if row[column] == "":
                collect.add("error", "required_value", f"필수값 `{column}`이 비어 있습니다.", row["area"])
            elif value is None or value < 0:
                collect.add("error", "range", f"`{column}`이 0 이상의 숫자가 아닙니다.", f"{row['area']}={row[column]}")
            else:
                values[column] = value
        if len(values) == len(columns):
            slots = sum(values[f"population_{slot}"] for slot in TIME_SLOTS)
            # 공식 API 표본(2026-11-10)에서 시간대별 반올림으로 합계가 ±1씩 달랐다. 시간대마다 1명 이내 오차를 허용한다.
            if abs(slots - values["total_population"]) > POPULATION_SUM_TOLERANCE:
                collect.add("warning", "sum_mismatch", f"시간대 유동인구 6개의 합이 총 유동인구와 {POPULATION_SUM_TOLERANCE}명 넘게 다릅니다.", row["area"])
        kept.append(row)
    return kept, per_quarter


# ---------------------------------------------------------------- 원천 읽기

SourceReader = Callable[[], tuple[list[str], Iterable[dict[str, str]]]]


def run_source(
    report: QualityReport,
    kind: str,
    reader: SourceReader | None,
    formats: dict[str, dict[str, str]],
    checker: Callable,
    area_codes: set[str] | None,
) -> list[dict]:
    collect = Collector(report, kind)
    if reader is None:
        report.sources.append(SourceResult(kind, "missing"))
        collect.add("error", "missing_source", "원천 파일이 없습니다.")
        return []
    columns, rows = reader()
    name, missing = detect_format(columns, formats)
    if name is None:
        best = min(missing.items(), key=lambda item: len(item[1]))
        report.sources.append(SourceResult(kind, "checked"))
        collect.add("error", "columns", f"필수 컬럼이 없습니다({best[0]} 형식 기준): {', '.join(best[1])}")
        return []
    kept, per_quarter = checker(normalize(rows, formats[name]), report.quarter, area_codes, collect)
    previous = per_quarter.get(previous_quarter(report.quarter))
    result = SourceResult(
        kind,
        "checked",
        format=name,
        rows_in_quarter=len(kept),
        previous_quarter_rows=previous,
        industries=len({row["industry"] for row in kept}) if kept and "industry" in kept[0] else None,
        areas=len({row["area"] for row in kept}) if kept else 0,
    )
    report.sources.append(result)
    if not kept:
        collect.add("error", "empty_quarter", f"기준분기 {report.quarter} 행이 없습니다.")
    elif previous:
        change = (len(kept) - previous) / previous
        if abs(change) > ROW_CHANGE_WARNING:
            collect.add("warning", "row_change", f"이전 분기({previous_quarter(report.quarter)}) {previous:,}행 대비 {change:+.1%} 변했습니다.")
    return kept


def find_files(raw: Path, pattern: str) -> list[Path]:
    return sorted(path for path in raw.glob(pattern) if path.is_file())


def year_file(raw: Path, folder: str, quarter: str) -> Path | None:
    matches = find_files(raw, f"{folder}/*_{quarter[:4]}년.zip")
    return matches[0] if len(matches) == 1 else None


def load_area_codes(report: QualityReport, raw: Path) -> tuple[set[str] | None, list]:
    from database.scripts.validate_phase1 import DISTRICTS, read_dbf_from_zip

    collect = Collector(report, "area")
    matches = find_files(raw, "area/*.zip")
    if len(matches) != 1:
        report.sources.append(SourceResult("area", "missing"))
        collect.add("error", "missing_source", f"영역 원천 ZIP이 하나여야 합니다({len(matches)}개).")
        return None, []
    report.files.append(FileManifest.of("area", matches[0], ROOT))
    rows = [row for row in read_dbf_from_zip(matches[0]) if row.get("SIGNGU_CD_") in DISTRICTS]
    codes = [row["TRDAR_CD"] for row in rows]
    duplicated = [code for code, count in Counter(codes).items() if count > 1]
    for code in duplicated:
        collect.add("error", "duplicate_key", "상권 코드가 중복됩니다.", code)
    districts = {row["SIGNGU_CD_"] for row in rows}
    if districts != DISTRICTS:
        collect.add("error", "districts", f"서울 25개 자치구 중 빠진 구가 있습니다: {', '.join(sorted(DISTRICTS - districts))}")
    report.sources.append(SourceResult("area", "checked", format="shp_dbf", rows_in_quarter=len(rows), areas=len(set(codes))))
    return set(codes), rows


def readers_for(raw: Path, quarter: str, report: QualityReport) -> dict[str, SourceReader | None]:
    readers: dict[str, SourceReader | None] = {}
    for kind, folder in (("store", "store"), ("sales", "sales")):
        path = year_file(raw, folder, quarter)
        if path is not None:
            report.files.append(FileManifest.of(kind, path, ROOT))
            readers[kind] = (lambda p=path: iter_zip_csv(p))
        else:
            readers[kind] = None
    population = find_files(raw, "population/*.csv")
    if len(population) == 1:
        report.files.append(FileManifest.of("population", population[0], ROOT))
        meta = find_files(raw, "population/*.meta.json")
        if len(meta) == 1:
            report.files.append(FileManifest.of("population_meta", meta[0], ROOT))
        readers["population"] = lambda p=population[0]: iter_csv(p)
    else:
        readers["population"] = None
    return readers


# ---------------------------------------------------------------- 임시 적재와 표본 대조


def trial_load(report: QualityReport, area_rows: list, stores: list[dict], sales: list[dict], populations: list[dict], directory: Path) -> Path:
    """검사를 통과한 행을 임시 SQLite에 적재한다. 운영 DB와 무관하다."""
    from pyproj import Transformer
    from sqlalchemy.orm import Session

    from app.db import Base, make_engine
    from app.models import PopulationMetric, SalesMetric, StoreMetric, TradeArea

    path = directory / f"trial-{report.quarter}.db"
    path.unlink(missing_ok=True)
    engine = make_engine(f"sqlite:///{path.as_posix()}")
    Base.metadata.create_all(engine)
    transformer = Transformer.from_crs("EPSG:5181", "EPSG:4326", always_xy=True)
    area_codes = {row["TRDAR_CD"] for row in area_rows}
    with Session(engine) as session, session.begin():
        for row in area_rows:
            x, y = float(row["XCNTS_VALU"]), float(row["YDNTS_VALU"])
            longitude, latitude = transformer.transform(x, y)
            session.add(TradeArea(
                code=row["TRDAR_CD"], name=row["TRDAR_CD_N"], district_code=row["SIGNGU_CD"],
                district_name=row["SIGNGU_CD_"], area_type_code=row["TRDAR_SE_C"], area_type_name=row["TRDAR_SE_1"],
                x_epsg5181=x, y_epsg5181=y, longitude=longitude, latitude=latitude,
            ))
        session.add_all(StoreMetric(
            quarter_code=row["quarter"], trade_area_code=row["area"], industry_code=row["industry"],
            industry_name=row["industry_name"], store_count=int(Decimal(row["store_count"])),
            opening_rate=float(row["opening_rate"]) if row["opening_rate"] else None,
            closing_rate=float(row["closing_rate"]) if row["closing_rate"] else None,
        ) for row in stores)
        session.add_all(SalesMetric(
            quarter_code=row["quarter"], trade_area_code=row["area"], industry_code=row["industry"],
            industry_name=row["industry_name"], sales_amount=int(Decimal(row["sales_amount"])),
            sales_count=int(Decimal(row["sales_count"])), weekday_sales_amount=int(Decimal(row["weekday_sales_amount"])),
            weekend_sales_amount=int(Decimal(row["weekend_sales_amount"])),
        ) for row in sales)
        session.add_all(PopulationMetric(
            quarter_code=row["quarter"], trade_area_code=row["area"],
            total_population=int(Decimal(row["total_population"])),
            **{f"population_{slot}": int(Decimal(row[f"population_{slot}"])) for slot in TIME_SLOTS},
        ) for row in populations if row["area"] in area_codes)
    engine.dispose()
    report.trial_load = {
        "database": path.name,
        "trade_areas": len(area_rows),
        "store_metrics": len(stores),
        "sales_metrics": len(sales),
        "population_metrics": sum(1 for row in populations if row["area"] in area_codes),
    }
    return path


def expected_from_raw(store: dict | None, sales: dict | None) -> dict[str, object]:
    """원천 행에서 직접 손계산한 기대값. 백엔드 계산 함수를 쓰지 않는다."""
    expected: dict[str, object] = {}
    if store:
        expected["store_count"] = int(Decimal(store["store_count"]))
    if sales:
        total = int(Decimal(sales["sales_amount"]))
        count = int(Decimal(sales["sales_count"]))
        expected["sales_amount"] = total
        expected["weekday_sales_ratio"] = ratio(int(Decimal(sales["weekday_sales_amount"])), total)
        expected["weekend_sales_ratio"] = ratio(int(Decimal(sales["weekend_sales_amount"])), total)
        expected["average_payment"] = (Decimal(total) / Decimal(count)).quantize(Decimal("1"), rounding=ROUND_HALF_UP) if count else None
    return expected


def compare_samples(report: QualityReport, database: Path, stores: list[dict], sales: list[dict]) -> None:
    from sqlalchemy.orm import Session

    from app.db import make_engine
    from app.metric_service import get_area_metrics

    collect = Collector(report, "sample")
    store_index = {(row["area"], row["industry"]): row for row in stores}
    sales_index = {(row["area"], row["industry"]): row for row in sales}
    samples: list[tuple[str, str]] = []
    for industry in SAMPLE_INDUSTRIES:
        keys = sorted(key for key in sales_index if key[1] == industry)
        samples.extend(keys[:3])
        store_only = sorted(key for key in store_index if key[1] == industry and key not in sales_index)
        samples.extend(store_only[:1])
    engine = make_engine(f"sqlite:///{database.as_posix()}")
    with Session(engine) as session:
        for area, industry in samples:
            _, metrics = get_area_metrics(session, area, report.quarter, industry)
            actual = {metric.metric_key: metric.value for metric in metrics if metric.status == "available"}
            expected = expected_from_raw(store_index.get((area, industry)), sales_index.get((area, industry)))
            mismatches = []
            for key, value in expected.items():
                got = actual.get(key)
                if value is None and got is None:
                    continue
                if got is None or Decimal(str(got)) != Decimal(str(value)):
                    mismatches.append(f"{key}: 기대 {value} / 계산 {got}")
            if (area, industry) not in sales_index and any(key in actual for key in ("sales_amount", "weekday_sales_ratio")):
                mismatches.append("매출 원천 행이 없는데 매출 지표가 계산됐습니다.")
            report.sample_checks.append({"trade_area": area, "industry": industry, "checked": sorted(expected), "mismatches": mismatches})
            if mismatches:
                collect.add("error", "sample_mismatch", "표본 지표의 손계산과 백엔드 계산이 다릅니다.", f"{area}·{industry}: {'; '.join(mismatches)}")
    engine.dispose()


# ---------------------------------------------------------------- 실행


def run(quarter: str, raw: Path, output: Path, trial: bool = True) -> QualityReport:
    report = QualityReport(quarter=quarter, started_at=datetime.now(timezone.utc).isoformat(timespec="seconds"))
    if not valid_quarter(quarter):
        Collector(report, "input").add("error", "quarter", f"기준분기 형식이 잘못됐습니다: {quarter} (예: 20254)")
        return report
    area_codes, area_rows = load_area_codes(report, raw)
    readers = readers_for(raw, quarter, report)
    stores = run_source(report, "store", readers["store"], STORE_FORMATS, check_store_rows, area_codes)
    sales = run_source(report, "sales", readers["sales"], SALES_FORMATS, check_sales_rows, area_codes)
    populations = run_source(report, "population", readers["population"], POPULATION_FORMATS, check_population_rows, area_codes)
    if stores and sales:
        store_industries = {row["industry"] for row in stores}
        missing = sorted({row["industry"] for row in sales} - store_industries)
        collect = Collector(report, "sales")
        for code in missing:
            collect.add("error", "industry_scope", "매출 업종 코드가 점포 원천에 없습니다.", code)
    blocking = [issue for issue in report.errors if issue.check != "missing_source" or issue.source != "population"]
    if trial and area_rows and stores and sales and not blocking:
        output.mkdir(parents=True, exist_ok=True)
        database = trial_load(report, area_rows, stores, sales, populations, output)
        compare_samples(report, database, stores, sales)
    return report


def to_markdown(report: QualityReport) -> str:
    data = report.to_dict()
    lines = [
        f"# 원천 데이터 품질 검사 — 기준분기 {report.quarter}",
        "",
        f"- 실행 시각(UTC): {report.started_at}",
        f"- 판정: **{'통과' if data['passed'] else '실패'}** (오류 {data['error_count']}건, 경고 {data['warning_count']}건)",
        "",
        "## 원천 파일",
        "",
        "| 종류 | 파일 | 크기(byte) | SHA-256 |",
        "| --- | --- | --- | --- |",
        *[f"| {item.kind} | {item.path} | {item.size_bytes:,} | `{item.sha256}` |" for item in report.files],
        "",
        "## 원천별 결과",
        "",
        "| 원천 | 상태 | 형식 | 기준분기 행 | 이전 분기 행 | 업종 | 상권 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        *[
            f"| {item.kind} | {item.status} | {item.format or '-'} | {item.rows_in_quarter:,} | "
            f"{'-' if item.previous_quarter_rows is None else f'{item.previous_quarter_rows:,}'} | "
            f"{'-' if item.industries is None else item.industries} | {'-' if item.areas is None else item.areas} |"
            for item in report.sources
        ],
        "",
        "## 검사 결과",
        "",
    ]
    if report.issues:
        lines += ["| 수준 | 원천 | 검사 | 내용 | 건수 | 예시 |", "| --- | --- | --- | --- | --- | --- |"]
        lines += [
            f"| {issue.level} | {issue.source} | {issue.check} | {issue.message} | {issue.count:,} | {', '.join(issue.examples) or '-'} |"
            for issue in report.issues
        ]
    else:
        lines.append("위반 없음.")
    lines += ["", "## 임시 적재와 표본 대조", ""]
    if report.trial_load:
        lines.append(f"- 임시 SQLite: {json.dumps(report.trial_load, ensure_ascii=False)}")
        ok = sum(1 for item in report.sample_checks if not item["mismatches"])
        lines.append(f"- 표본 {len(report.sample_checks)}건 중 {ok}건 일치")
        lines += [
            f"  - {item['trade_area']}·{item['industry']}: {', '.join(item['checked'])} → {'일치' if not item['mismatches'] else '; '.join(item['mismatches'])}"
            for item in report.sample_checks
        ]
    else:
        lines.append("- 차단 오류가 있거나 필요한 원천이 없어 수행하지 않았습니다.")
    if report.applied:
        lines += ["", "## 반영", "", f"- {json.dumps(report.applied, ensure_ascii=False)}"]
    return "\n".join(lines) + "\n"


def write_report(report: QualityReport, output: Path) -> tuple[Path, Path]:
    output.mkdir(parents=True, exist_ok=True)
    stamp = report.started_at.replace(":", "").replace("-", "")[:15]
    json_path = output / f"{report.quarter}-{stamp}.json"
    md_path = output / f"{report.quarter}-{stamp}.md"
    json_path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    md_path.write_text(to_markdown(report), encoding="utf-8")
    return json_path, md_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="원천 데이터 품질 검사·갱신 파이프라인")
    parser.add_argument("--quarter", default="20254", help="검사할 기준분기 (예: 20254)")
    parser.add_argument("--raw", type=Path, default=ROOT / "database" / "raw")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--skip-trial", action="store_true", help="임시 적재와 표본 대조를 건너뜀")
    parser.add_argument("--apply", action="store_true", help="검사를 모두 통과하면 --database-url에 반영")
    parser.add_argument("--database-url", help="--apply 대상 DB. 생략하면 backend/.env의 DATABASE_URL")
    args = parser.parse_args(argv)

    report = run(args.quarter, args.raw, args.output, trial=not args.skip_trial)
    if args.apply:
        if report.errors:
            print("검사 오류가 있어 반영하지 않았습니다.", file=sys.stderr)
        else:
            from database.scripts.load_data import QUARTER, load

            if args.quarter != QUARTER:
                print(f"현재 적재 스크립트는 기준분기 {QUARTER}만 반영합니다.", file=sys.stderr)
                report.applied = {"status": "skipped", "reason": f"load_data.py 기준분기 {QUARTER}"}
            else:
                report.applied = {"status": "applied", "counts": load(args.database_url)}
    json_path, md_path = write_report(report, args.output)
    data = report.to_dict()
    print(f"판정: {'통과' if data['passed'] else '실패'} — 오류 {data['error_count']}건, 경고 {data['warning_count']}건")
    for issue in report.issues:
        print(f"  [{issue.level}] {issue.source}.{issue.check}: {issue.message} ({issue.count:,}건)")
    print(f"리포트: {md_path.relative_to(ROOT) if md_path.is_relative_to(ROOT) else md_path}")
    print(f"        {json_path.relative_to(ROOT) if json_path.is_relative_to(ROOT) else json_path}")
    return 0 if data["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
