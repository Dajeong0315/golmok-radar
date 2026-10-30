"""Phase 1 원천 데이터의 상권 코드·분기·업종 결합 가능성을 검증한다.

실행:
    python database/scripts/validate_phase1.py

원천 파일은 수정하지 않는다. 검증 결과는 Git 제외 대상인
database/processed/phase1_validation.json 에 저장한다.
"""

from __future__ import annotations

import csv
import io
import json
import struct
import sys
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "database" / "raw"
REPORT = ROOT / "database" / "processed" / "phase1_validation.json"

QUARTER = "20254"
INDUSTRY = "CS100010"
DISTRICTS = {
    "강남구", "강동구", "강북구", "강서구", "관악구",
    "광진구", "구로구", "금천구", "노원구", "도봉구",
    "동대문구", "동작구", "마포구", "서대문구", "서초구",
    "성동구", "성북구", "송파구", "양천구", "영등포구",
    "용산구", "은평구", "종로구", "중구", "중랑구",
}


def decode_text(value: bytes) -> str:
    value = value.rstrip(b"\x00 ")
    for encoding in ("utf-8", "cp949"):
        try:
            return value.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return value.decode("utf-8", errors="replace").strip()


def read_dbf_from_zip(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        entry = next(name for name in archive.namelist() if name.lower().endswith(".dbf"))
        data = archive.read(entry)

    record_count = struct.unpack_from("<I", data, 4)[0]
    header_length = struct.unpack_from("<H", data, 8)[0]
    record_length = struct.unpack_from("<H", data, 10)[0]

    fields: list[tuple[str, int]] = []
    for offset in range(32, header_length - 1, 32):
        name = decode_text(data[offset : offset + 11])
        length = data[offset + 16]
        fields.append((name, length))

    rows: list[dict[str, str]] = []
    for index in range(record_count):
        start = header_length + index * record_length
        record = data[start : start + record_length]
        if not record or record[0:1] == b"*":
            continue
        cursor = 1
        row: dict[str, str] = {}
        for name, length in fields:
            row[name] = decode_text(record[cursor : cursor + length])
            cursor += length
        rows.append(row)
    return rows


def csv_rows_from_zip(path: Path) -> csv.DictReader:
    archive = zipfile.ZipFile(path)
    entry = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
    text = io.TextIOWrapper(archive.open(entry), encoding="cp949", newline="")
    reader = csv.DictReader(text)
    reader._golmok_resources = (text, archive)  # type: ignore[attr-defined]
    return reader


def close_zip_reader(reader: csv.DictReader) -> None:
    text, archive = reader._golmok_resources  # type: ignore[attr-defined]
    text.close()
    archive.close()


def find_one(pattern: str) -> Path:
    matches = sorted(ROOT.glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(f"파일을 하나만 찾을 수 있어야 합니다: {pattern} -> {len(matches)}개")
    return matches[0]


def duplicates(values: list[str]) -> list[str]:
    return sorted(value for value, count in Counter(values).items() if count > 1)


def main() -> None:
    area_zip = find_one("database/raw/area/*.zip")
    store_zip = find_one("database/raw/store/*_2025년.zip")
    sales_zip = find_one("database/raw/sales/*_2025년.zip")
    population_csv = find_one("database/raw/population/*.csv")
    population_meta = find_one("database/raw/population/*.meta.json")

    area_rows = read_dbf_from_zip(area_zip)
    area_rows_in_scope = [row for row in area_rows if row.get("SIGNGU_CD_") in DISTRICTS]
    area_codes = {row["TRDAR_CD"] for row in area_rows_in_scope}
    covered_districts = {row["SIGNGU_CD_"] for row in area_rows_in_scope}
    area_count_by_district = Counter(row["SIGNGU_CD_"] for row in area_rows_in_scope)

    store_reader = csv_rows_from_zip(store_zip)
    try:
        store_codes = [
            row["trdar_cd"]
            for row in store_reader
            if row["stdr_yyqu_cd"] == QUARTER
            and row["svc_induty_cd"] == INDUSTRY
            and row["trdar_cd"] in area_codes
        ]
    finally:
        close_zip_reader(store_reader)

    sales_reader = csv_rows_from_zip(sales_zip)
    try:
        sales_codes = [
            row["상권_코드"]
            for row in sales_reader
            if row["기준_년분기_코드"] == QUARTER
            and row["서비스_업종_코드"] == INDUSTRY
            and row["상권_코드"] in area_codes
        ]
    finally:
        close_zip_reader(sales_reader)

    with population_csv.open(encoding="utf-8-sig", newline="") as file:
        population_reader = csv.DictReader(file)
        population_columns = population_reader.fieldnames or []
        population_codes = [
            row["TRDAR_CD"]
            for row in population_reader
            if row["STDR_YYQU_CD"] == QUARTER and row["TRDAR_CD"] in area_codes
        ]

    meta = json.loads(population_meta.read_text(encoding="utf-8"))
    store_set = set(store_codes)
    sales_set = set(sales_codes)
    population_set = set(population_codes)
    all_sources = area_codes & store_set & sales_set & population_set

    required_population_columns = {
        "STDR_YYQU_CD",
        "TRDAR_CD",
        "TOT_FLPOP_CO",
        "TMZON_00_06_FLPOP_CO",
        "TMZON_06_11_FLPOP_CO",
        "TMZON_11_14_FLPOP_CO",
        "TMZON_14_17_FLPOP_CO",
        "TMZON_17_21_FLPOP_CO",
        "TMZON_21_24_FLPOP_CO",
    }

    report = {
        "quarter": QUARTER,
        "industry": INDUSTRY,
        "districts": sorted(DISTRICTS),
        "covered_districts": sorted(covered_districts),
        "missing_districts": sorted(DISTRICTS - covered_districts),
        "area_count_by_district": dict(sorted(area_count_by_district.items())),
        "population_api": {
            "service": meta.get("service"),
            "reported_rows": meta.get("total_count_reported"),
            "saved_rows": meta.get("rows_saved"),
            "quarters": meta.get("quarters"),
            "missing_required_columns": sorted(required_population_columns - set(population_columns)),
        },
        "counts": {
            "area": len(area_codes),
            "store": len(store_set),
            "sales": len(sales_set),
            "population": len(population_set),
            "all_sources": len(all_sources),
        },
        "duplicates": {
            "store": duplicates(store_codes),
            "sales": duplicates(sales_codes),
            "population": duplicates(population_codes),
        },
        "missing_by_source": {
            "store": sorted(area_codes - store_set),
            "sales": sorted(area_codes - sales_set),
            "population": sorted(area_codes - population_set),
        },
        "go": covered_districts == DISTRICTS and len(all_sources) >= 3,
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if meta.get("total_count_reported") != meta.get("rows_saved"):
        sys.exit("API 보고 행 수와 저장 행 수가 다릅니다.")
    if report["population_api"]["missing_required_columns"]:
        sys.exit("인구 필수 컬럼이 없습니다.")
    if any(report["duplicates"].values()):
        sys.exit("상권·분기·업종 논리 키가 중복됩니다.")
    if report["missing_districts"]:
        sys.exit("영역 데이터에 서울 25개 자치구가 모두 존재하지 않습니다.")
    if not report["go"]:
        sys.exit("세 데이터 공통 상권이 3개 미만입니다.")


if __name__ == "__main__":
    main()
