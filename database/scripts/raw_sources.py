"""원천 파일의 컬럼 이름을 공통 키로 바꾸는 규칙과 읽기 도구.

원천은 받은 형식에 따라 컬럼 이름이 다르다.
- 점포 2025 ZIP: 영문 소문자 (`stdr_yyqu_cd`, `trdar_cd` ...)
- 추정매출 2025 ZIP: 한글 (`기준_년분기_코드`, `상권_코드` ...)
- 열린데이터광장 Open API: 영문 대문자 (`STDR_YYQU_CD`, `TRDAR_CD` ...)

각 형식의 실제 컬럼 이름은 2026-11-10 원천 파일과 API 응답에서 확인했다
(`docs/data_sources.md`). 확인하지 않은 형식은 추가하지 않는다.
원천 파일은 읽기만 하고 수정하지 않는다.
"""

from __future__ import annotations

import csv
import hashlib
import io
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator


TIME_SLOTS = ("00_06", "06_11", "11_14", "14_17", "17_21", "21_24")

# 공통 키 → 형식별 원천 컬럼 이름
STORE_FORMATS: dict[str, dict[str, str]] = {
    "zip_2025_lower": {
        "quarter": "stdr_yyqu_cd",
        "area": "trdar_cd",
        "industry": "svc_induty_cd",
        "industry_name": "svc_induty_cd_nm",
        "store_count": "stor_co",
        "opening_rate": "opbiz_rt",
        "closing_rate": "clsbiz_rt",
        "similar_store_count": "similr_induty_stor_co",
        "opening_store_count": "opbiz_stor_co",
        "closing_store_count": "clsbiz_stor_co",
    },
    "open_api": {
        "quarter": "STDR_YYQU_CD",
        "area": "TRDAR_CD",
        "industry": "SVC_INDUTY_CD",
        "industry_name": "SVC_INDUTY_CD_NM",
        "store_count": "STOR_CO",
        "opening_rate": "OPBIZ_RT",
        "closing_rate": "CLSBIZ_RT",
        "similar_store_count": "SIMILR_INDUTY_STOR_CO",
        "opening_store_count": "OPBIZ_STOR_CO",
        "closing_store_count": "CLSBIZ_STOR_CO",
    },
}

SALES_FORMATS: dict[str, dict[str, str]] = {
    "zip_korean": {
        "quarter": "기준_년분기_코드",
        "area": "상권_코드",
        "industry": "서비스_업종_코드",
        "industry_name": "서비스_업종_코드_명",
        "sales_amount": "당월_매출_금액",
        "sales_count": "당월_매출_건수",
        "weekday_sales_amount": "주중_매출_금액",
        "weekend_sales_amount": "주말_매출_금액",
        **{f"sales_{slot}": f"시간대_{slot.replace('_', '~')}_매출_금액" for slot in TIME_SLOTS},
    },
    "open_api": {
        "quarter": "STDR_YYQU_CD",
        "area": "TRDAR_CD",
        "industry": "SVC_INDUTY_CD",
        "industry_name": "SVC_INDUTY_CD_NM",
        "sales_amount": "THSMON_SELNG_AMT",
        "sales_count": "THSMON_SELNG_CO",
        "weekday_sales_amount": "MDWK_SELNG_AMT",
        "weekend_sales_amount": "WKEND_SELNG_AMT",
        **{f"sales_{slot}": f"TMZON_{slot}_SELNG_AMT" for slot in TIME_SLOTS},
    },
}

POPULATION_FORMATS: dict[str, dict[str, str]] = {
    "open_api": {
        "quarter": "STDR_YYQU_CD",
        "area": "TRDAR_CD",
        "total_population": "TOT_FLPOP_CO",
        **{f"population_{slot}": f"TMZON_{slot}_FLPOP_CO" for slot in TIME_SLOTS},
    },
}


DATASET_NAMES = {
    "store": "서울시 상권분석서비스(점포-상권)",
    "sales": "서울시 상권분석서비스(추정매출-상권)",
}


@dataclass(frozen=True)
class QuarterFile:
    """한 기준분기의 점포·매출 원천 위치.

    `fetch_quarter.py`로 받은 분기별 Open API CSV가 있으면 그것을, 없으면 연도별 ZIP을 쓴다.
    """

    kind: str
    origin: str  # "openapi" | "zip"
    path: Path
    meta_path: Path | None = None

    def reader(self) -> tuple[list[str], Iterator[dict[str, str]]]:
        return iter_csv(self.path) if self.origin == "openapi" else iter_zip_csv(self.path)


def api_csv_path(raw: Path, kind: str, quarter: str) -> Path:
    return raw / kind / f"{DATASET_NAMES[kind]}_{quarter}_OpenAPI.csv"


def resolve_quarter_file(raw: Path, kind: str, quarter: str) -> QuarterFile | None:
    api = api_csv_path(raw, kind, quarter)
    if api.is_file():
        meta = api.with_suffix(".meta.json")
        return QuarterFile(kind, "openapi", api, meta if meta.is_file() else None)
    matches = sorted(path for path in (raw / kind).glob(f"*_{quarter[:4]}년.zip") if path.is_file())
    return QuarterFile(kind, "zip", matches[0]) if len(matches) == 1 else None


@dataclass(frozen=True)
class FileManifest:
    kind: str
    path: str
    size_bytes: int
    sha256: str
    modified_at: str

    @classmethod
    def of(cls, kind: str, path: Path, root: Path) -> "FileManifest":
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        stat = path.stat()
        try:
            shown = path.relative_to(root).as_posix()
        except ValueError:
            shown = path.name
        return cls(
            kind=kind,
            path=shown,
            size_bytes=stat.st_size,
            sha256=digest.hexdigest(),
            modified_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(timespec="seconds"),
        )


def detect_format(columns: Iterable[str], formats: dict[str, dict[str, str]]) -> tuple[str | None, dict[str, list[str]]]:
    """컬럼 목록과 가장 잘 맞는 형식과, 형식별로 빠진 원천 컬럼을 돌려준다."""
    present = set(columns)
    missing = {name: [column for column in mapping.values() if column not in present] for name, mapping in formats.items()}
    complete = [name for name, columns_missing in missing.items() if not columns_missing]
    return (complete[0] if complete else None), missing


def normalize(rows: Iterable[dict[str, str]], mapping: dict[str, str]) -> Iterator[dict[str, str]]:
    for row in rows:
        yield {key: (row.get(column) or "").strip() for key, column in mapping.items()}


def iter_zip_csv(path: Path, encoding: str = "cp949") -> tuple[list[str], Iterator[dict[str, str]]]:
    """ZIP 안의 CSV 하나를 읽는다. 컬럼 목록과 행 반복자를 돌려준다."""
    archive = zipfile.ZipFile(path)
    entry = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
    text = io.TextIOWrapper(archive.open(entry), encoding=encoding, newline="")
    reader = csv.DictReader(text)
    columns = list(reader.fieldnames or [])

    def rows() -> Iterator[dict[str, str]]:
        try:
            yield from reader
        finally:
            text.close()
            archive.close()

    return columns, rows()


def iter_csv(path: Path, encoding: str = "utf-8-sig") -> tuple[list[str], Iterator[dict[str, str]]]:
    file = path.open(encoding=encoding, newline="")
    reader = csv.DictReader(file)
    columns = list(reader.fieldnames or [])

    def rows() -> Iterator[dict[str, str]]:
        try:
            yield from reader
        finally:
            file.close()

    return columns, rows()
