import csv
import io
import zipfile
from pathlib import Path

import pytest

from database.scripts import data_quality as dq
from database.scripts.raw_sources import SALES_FORMATS, STORE_FORMATS


QUARTER = "20254"
AREAS = {"A1", "A2"}

STORE_HEADER = list(STORE_FORMATS["zip_2025_lower"].values())
SALES_HEADER = list(SALES_FORMATS["zip_korean"].values())
POP_HEADER = ["STDR_YYQU_CD", "TRDAR_CD", "TOT_FLPOP_CO", *[f"TMZON_{s}_FLPOP_CO" for s in dq.TIME_SLOTS]]


def store_row(area="A1", industry="CS100010", name="커피-음료", count="2", op="50", cl="0", quarter=QUARTER, similar="2", opened="1", closed="0"):
    return dict(zip(STORE_HEADER, [quarter, area, industry, name, count, op, cl, similar, opened, closed]))


def sales_row(area="A1", industry="CS100010", name="커피-음료", total=1000, count=10, weekday=700, weekend=300, slots=(0, 100, 300, 200, 300, 100), quarter=QUARTER):
    values = [quarter, area, industry, name, total, count, weekday, weekend, *slots]
    return dict(zip(SALES_HEADER, [str(value) for value in values]))


def pop_row(area="A1", total=120, slots=(10, 20, 30, 20, 30, 10), quarter=QUARTER):
    return dict(zip(POP_HEADER, [quarter, area, str(total), *map(str, slots)]))


def normalized(rows, mapping):
    return list(dq.normalize(rows, mapping))


def checked(checker, rows, mapping, areas=AREAS):
    report = dq.QualityReport(QUARTER, "now")
    collect = dq.Collector(report, "test")
    kept, _ = checker(normalized(rows, mapping), QUARTER, areas, collect)
    return report, kept


def checks(report, level="error"):
    return sorted({issue.check for issue in report.issues if issue.level == level})


def test_valid_store_sales_and_population_rows_pass() -> None:
    for checker, rows, mapping in (
        (dq.check_store_rows, [store_row(), store_row("A2")], STORE_FORMATS["zip_2025_lower"]),
        (dq.check_sales_rows, [sales_row(), sales_row("A2")], SALES_FORMATS["zip_korean"]),
        (dq.check_population_rows, [pop_row(), pop_row("A2")], dq.POPULATION_FORMATS["open_api"]),
    ):
        report, kept = checked(checker, rows, mapping)
        assert report.issues == []
        assert len(kept) == 2


def test_other_quarters_are_counted_but_not_checked() -> None:
    report = dq.QualityReport(QUARTER, "now")
    rows = normalized([sales_row(), sales_row(quarter="20253", total=-1)], SALES_FORMATS["zip_korean"])
    kept, per_quarter = dq.check_sales_rows(rows, QUARTER, AREAS, dq.Collector(report, "sales"))
    assert len(kept) == 1
    assert per_quarter == {"20254": 1, "20253": 1}
    assert report.issues == []


@pytest.mark.parametrize(
    ("row", "expected"),
    [
        (sales_row(area="ZZ"), "unknown_area"),
        (sales_row(total=""), "required_value"),
        (sales_row(total=-5, weekday=-5, weekend=0, slots=(0, 0, 0, 0, 0, -5)), "range"),
        (sales_row(weekday=600), "sum_mismatch"),
        (sales_row(slots=(0, 0, 0, 0, 0, 1)), "sum_mismatch"),
    ],
)
def test_sales_row_errors(row, expected) -> None:
    report, _ = checked(dq.check_sales_rows, [row], SALES_FORMATS["zip_korean"])
    assert expected in checks(report)


def test_duplicate_key_and_industry_name_conflict_are_errors() -> None:
    report, _ = checked(dq.check_sales_rows, [sales_row(), sales_row()], SALES_FORMATS["zip_korean"])
    assert checks(report) == ["duplicate_key"]
    report, _ = checked(dq.check_store_rows, [store_row(), store_row("A2", name="다른 이름")], STORE_FORMATS["zip_2025_lower"])
    assert checks(report) == ["industry_name"]


def test_store_rate_follows_source_definition() -> None:
    # 원천 정의: 폐업 점포 수 ÷ 유사업종 점포 수 × 100. 100%를 넘을 수 있다.
    report, _ = checked(dq.check_store_rows, [store_row(op="0", opened="0", cl="200", similar="1", closed="2")], STORE_FORMATS["zip_2025_lower"])
    assert report.issues == []
    report, _ = checked(dq.check_store_rows, [store_row(cl="-1")], STORE_FORMATS["zip_2025_lower"])
    assert checks(report) == ["range"]
    report, _ = checked(dq.check_store_rows, [store_row(op="90")], STORE_FORMATS["zip_2025_lower"])
    assert checks(report) == [] and checks(report, "warning") == ["rate_definition"]
    report, _ = checked(dq.check_store_rows, [store_row(count="1.5")], STORE_FORMATS["zip_2025_lower"])
    assert checks(report) == ["range"]


def test_population_rounding_tolerance_and_outside_rows() -> None:
    report, _ = checked(dq.check_population_rows, [pop_row(total=121)], dq.POPULATION_FORMATS["open_api"])
    assert report.issues == []
    report, _ = checked(dq.check_population_rows, [pop_row(total=200)], dq.POPULATION_FORMATS["open_api"])
    assert checks(report, "warning") == ["sum_mismatch"]
    report, kept = checked(dq.check_population_rows, [pop_row(area="ZZ")], dq.POPULATION_FORMATS["open_api"])
    assert checks(report, "warning") == ["outside_area"] and kept == []


def test_missing_columns_and_empty_quarter_are_reported() -> None:
    report = dq.QualityReport(QUARTER, "now")
    reader = lambda: (["상권_코드"], iter([]))  # noqa: E731
    assert dq.run_source(report, "sales", reader, SALES_FORMATS, dq.check_sales_rows, AREAS) == []
    assert report.issues[0].check == "columns"
    report = dq.QualityReport(QUARTER, "now")
    reader = lambda: (SALES_HEADER, iter([sales_row(quarter="20253")]))  # noqa: E731
    dq.run_source(report, "sales", reader, SALES_FORMATS, dq.check_sales_rows, AREAS)
    assert checks(report) == ["empty_quarter"]


def test_row_count_change_warning() -> None:
    report = dq.QualityReport(QUARTER, "now")
    rows = [sales_row(area=a) for a in ("A1", "A2")] + [sales_row(area=f"B{i}", quarter="20253") for i in range(5)]
    dq.run_source(report, "sales", lambda: (SALES_HEADER, iter(rows)), SALES_FORMATS, dq.check_sales_rows, None)
    assert checks(report, "warning") == ["row_change"]


def test_previous_quarter_and_input_validation() -> None:
    assert dq.previous_quarter("20261") == "20254"
    assert dq.previous_quarter("20254") == "20253"
    assert dq.run("2025Q4", Path("."), Path(".")).errors[0].check == "quarter"


def write_zip_csv(path: Path, header: list[str], rows: list[dict]) -> None:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=header)
    writer.writeheader()
    writer.writerows(rows)
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("data.csv", buffer.getvalue().encode("cp949"))


def make_raw(tmp_path: Path, sales_rows=None, with_population=True) -> Path:
    raw = tmp_path / "raw"
    write_zip_csv(raw / "store" / "점포_2025년.zip", STORE_HEADER, [store_row(), store_row("A2"), store_row("A2", "CS100001", "한식")])
    write_zip_csv(raw / "sales" / "매출_2025년.zip", SALES_HEADER, sales_rows or [sales_row(), sales_row("A2", total=999, count=7, weekday=500, weekend=499, slots=(0, 0, 999, 0, 0, 0))])
    if with_population:
        population = raw / "population" / "pop.csv"
        population.parent.mkdir(parents=True)
        with population.open("w", encoding="utf-8-sig", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=POP_HEADER)
            writer.writeheader()
            writer.writerows([pop_row(), pop_row("A2")])
    return raw


AREA_ROWS = [
    {"TRDAR_CD": code, "TRDAR_CD_N": f"상권{code}", "SIGNGU_CD": "11200", "SIGNGU_CD_": "성동구",
     "TRDAR_SE_C": "A", "TRDAR_SE_1": "골목상권", "XCNTS_VALU": "205000", "YDNTS_VALU": "450000"}
    for code in sorted(AREAS)
]


@pytest.fixture
def fake_area(monkeypatch):
    def load_area_codes(report, _raw):
        report.sources.append(dq.SourceResult("area", "checked", "fixture", len(AREA_ROWS)))
        return set(AREAS), AREA_ROWS

    monkeypatch.setattr(dq, "load_area_codes", load_area_codes)


def test_end_to_end_trial_load_and_sample_comparison(tmp_path: Path, fake_area) -> None:
    report = dq.run(QUARTER, make_raw(tmp_path), tmp_path / "out")
    assert report.errors == []
    assert report.trial_load == {"database": "trial-20254.db", "trade_areas": 2, "store_metrics": 3, "sales_metrics": 2, "population_metrics": 2}
    assert report.sample_checks and all(not item["mismatches"] for item in report.sample_checks)
    # 매출 원천이 없는 업종은 점포 지표만 대조하고 매출을 만들지 않는다.
    store_only = next(item for item in report.sample_checks if item["industry"] == "CS100001")
    assert store_only["checked"] == ["store_count"]
    assert {item.kind for item in report.files} == {"store:zip", "sales:zip", "population"}
    json_path, md_path = dq.write_report(report, tmp_path / "out")
    assert "통과" in md_path.read_text(encoding="utf-8") and json_path.exists()


def test_errors_block_trial_load_and_apply(tmp_path: Path, fake_area, monkeypatch) -> None:
    raw = make_raw(tmp_path, sales_rows=[sales_row(), sales_row()])
    monkeypatch.setattr("database.scripts.load_data.load", lambda *_: pytest.fail("오류가 있으면 반영하면 안 됩니다."))
    assert dq.main(["--quarter", QUARTER, "--raw", str(raw), "--output", str(tmp_path / "out"), "--apply", "--database-url", "sqlite://"]) == 1
    report = dq.run(QUARTER, raw, tmp_path / "out")
    assert report.trial_load is None and "duplicate_key" in checks(report)


def test_missing_population_blocks_apply_but_keeps_trial(tmp_path: Path, fake_area) -> None:
    report = dq.run(QUARTER, make_raw(tmp_path, with_population=False), tmp_path / "out")
    assert [(issue.source, issue.check) for issue in report.errors] == [("population", "missing_source")]
    assert report.trial_load["population_metrics"] == 0
