"""검증된 2025년 4분기 전체 업종 상권 데이터를 서비스 DB에 적재한다.

기본 실행:
    python database/scripts/load_data.py

다른 DB 사용:
    python database/scripts/load_data.py --database-url sqlite:///경로.db
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from pyproj import Transformer
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.db import Base, make_engine  # noqa: E402
from app.models import DataSource, PopulationMetric, SalesMetric, StoreMetric, TradeArea  # noqa: E402
from database.scripts.validate_phase1 import (  # noqa: E402
    DISTRICTS,
    QUARTER,
    close_zip_reader,
    csv_rows_from_zip,
    find_one,
    read_dbf_from_zip,
)


def as_int(value: str) -> int:
    if value in ("", None):
        raise ValueError("필수 원천값이 비어 있습니다.")
    return int(Decimal(value))


def as_float_or_none(value: str) -> float | None:
    return float(value) if value not in ("", None) else None


def collect_rows() -> tuple[list[TradeArea], list[StoreMetric], list[SalesMetric], list[PopulationMetric], list[DataSource]]:
    area_zip = find_one("database/raw/area/*.zip")
    store_zip = find_one("database/raw/store/*_2025년.zip")
    sales_zip = find_one("database/raw/sales/*_2025년.zip")
    population_csv = find_one("database/raw/population/*.csv")
    population_meta = find_one("database/raw/population/*.meta.json")

    transformer = Transformer.from_crs("EPSG:5181", "EPSG:4326", always_xy=True)
    trade_areas: list[TradeArea] = []
    for row in read_dbf_from_zip(area_zip):
        if row.get("SIGNGU_CD_") not in DISTRICTS:
            continue
        x = float(row["XCNTS_VALU"])
        y = float(row["YDNTS_VALU"])
        longitude, latitude = transformer.transform(x, y)
        trade_areas.append(
            TradeArea(
                code=row["TRDAR_CD"],
                name=row["TRDAR_CD_N"],
                district_code=row["SIGNGU_CD"],
                district_name=row["SIGNGU_CD_"],
                area_type_code=row["TRDAR_SE_C"],
                area_type_name=row["TRDAR_SE_1"],
                x_epsg5181=x,
                y_epsg5181=y,
                longitude=longitude,
                latitude=latitude,
            )
        )
    area_codes = {area.code for area in trade_areas}

    store_metrics: list[StoreMetric] = []
    store_keys: set[tuple[str, str, str]] = set()
    store_industries: dict[str, str] = {}
    store_reader = csv_rows_from_zip(store_zip)
    try:
        for row in store_reader:
            if row["stdr_yyqu_cd"] == QUARTER:
                if row["trdar_cd"] not in area_codes:
                    raise ValueError("점포 원천의 상권 코드가 공식 영역에 없습니다.")
                key = (QUARTER, row["trdar_cd"], row["svc_induty_cd"])
                if key in store_keys:
                    raise ValueError(f"점포 논리 키 중복: {key}")
                store_keys.add(key)
                name = row["svc_induty_cd_nm"]
                if row["svc_induty_cd"] in store_industries and store_industries[row["svc_induty_cd"]] != name:
                    raise ValueError(f"점포 업종명 불일치: {row['svc_induty_cd']}")
                store_industries[row["svc_induty_cd"]] = name
                store_metrics.append(
                    StoreMetric(
                        quarter_code=QUARTER,
                        trade_area_code=row["trdar_cd"],
                        industry_code=row["svc_induty_cd"],
                        industry_name=name,
                        store_count=as_int(row["stor_co"]),
                        opening_rate=as_float_or_none(row["opbiz_rt"]),
                        closing_rate=as_float_or_none(row["clsbiz_rt"]),
                    )
                )
    finally:
        close_zip_reader(store_reader)

    sales_metrics: list[SalesMetric] = []
    sales_keys: set[tuple[str, str, str]] = set()
    sales_industries: dict[str, str] = {}
    sales_reader = csv_rows_from_zip(sales_zip)
    try:
        for row in sales_reader:
            if row["기준_년분기_코드"] == QUARTER:
                if row["상권_코드"] not in area_codes:
                    raise ValueError("매출 원천의 상권 코드가 공식 영역에 없습니다.")
                key = (QUARTER, row["상권_코드"], row["서비스_업종_코드"])
                if key in sales_keys:
                    raise ValueError(f"매출 논리 키 중복: {key}")
                sales_keys.add(key)
                name = row["서비스_업종_코드_명"]
                if row["서비스_업종_코드"] in sales_industries and sales_industries[row["서비스_업종_코드"]] != name:
                    raise ValueError(f"매출 업종명 불일치: {row['서비스_업종_코드']}")
                sales_industries[row["서비스_업종_코드"]] = name
                sales_metrics.append(
                    SalesMetric(
                        quarter_code=QUARTER,
                        trade_area_code=row["상권_코드"],
                        industry_code=row["서비스_업종_코드"],
                        industry_name=name,
                        sales_amount=as_int(row["당월_매출_금액"]),
                        sales_count=as_int(row["당월_매출_건수"]),
                        weekday_sales_amount=as_int(row["주중_매출_금액"]),
                        weekend_sales_amount=as_int(row["주말_매출_금액"]),
                    )
                )
    finally:
        close_zip_reader(sales_reader)
    if not set(sales_industries).issubset(store_industries):
        raise ValueError("매출 업종 코드가 점포 원천에 없습니다.")

    population_metrics: list[PopulationMetric] = []
    with population_csv.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            if row["STDR_YYQU_CD"] == QUARTER and row["TRDAR_CD"] in area_codes:
                population_metrics.append(
                    PopulationMetric(
                        quarter_code=QUARTER,
                        trade_area_code=row["TRDAR_CD"],
                        total_population=as_int(row["TOT_FLPOP_CO"]),
                        population_00_06=as_int(row["TMZON_00_06_FLPOP_CO"]),
                        population_06_11=as_int(row["TMZON_06_11_FLPOP_CO"]),
                        population_11_14=as_int(row["TMZON_11_14_FLPOP_CO"]),
                        population_14_17=as_int(row["TMZON_14_17_FLPOP_CO"]),
                        population_17_21=as_int(row["TMZON_17_21_FLPOP_CO"]),
                        population_21_24=as_int(row["TMZON_21_24_FLPOP_CO"]),
                    )
                )

    meta = json.loads(population_meta.read_text(encoding="utf-8"))
    quarters = meta.get("quarters", [])
    sources = [
        DataSource(
            key="area",
            dataset_name="서울시 상권분석서비스(영역-상권)",
            provider="서울신용보증재단",
            source_file=area_zip.name,
            notes="EPSG:5181 중심좌표를 WGS84로 변환",
        ),
        DataSource(
            key="store",
            dataset_name="서울시 상권분석서비스(점포-상권)",
            provider="서울신용보증재단",
            source_file=store_zip.name,
            quarter_min="20251",
            quarter_max="20254",
        ),
        DataSource(
            key="sales",
            dataset_name="서울시 상권분석서비스(추정매출-상권)",
            provider="서울신용보증재단",
            source_file=sales_zip.name,
            quarter_min="20251",
            quarter_max="20254",
        ),
        DataSource(
            key="population",
            dataset_name=meta["dataset"],
            provider=meta["provider"],
            source_file=meta["file"],
            fetched_at=datetime.fromisoformat(meta["fetched_at"]),
            quarter_min=min(quarters),
            quarter_max=max(quarters),
            notes=f"Open API service={meta['service']}, rows={meta['rows_saved']}",
        ),
    ]
    return trade_areas, store_metrics, sales_metrics, population_metrics, sources


def load(database_url: str | None = None) -> dict[str, int]:
    engine = make_engine(database_url)
    if engine.url.get_backend_name() == "sqlite" and engine.url.database not in (None, ":memory:"):
        Path(engine.url.database).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)

    trade_areas, stores, sales, populations, sources = collect_rows()
    with Session(engine) as session, session.begin():
        for model in (PopulationMetric, SalesMetric, StoreMetric):
            session.execute(delete(model))
        session.execute(delete(DataSource).where(DataSource.key.in_([source.key for source in sources])))
        existing_codes = set(session.scalars(select(TradeArea.code)).all())
        source_codes = {area.code for area in trade_areas}
        if not existing_codes.issubset(source_codes):
            raise ValueError("기존 공식 상권 코드가 새 원천에 없습니다. 계정 관심 상권을 보존해야 합니다.")
        session.add_all(area for area in trade_areas if area.code not in existing_codes)
        session.add_all(stores)
        session.add_all(sales)
        session.add_all(populations)
        session.add_all(sources)

    with Session(engine) as session:
        return {
            "trade_areas": session.scalar(select(func.count()).select_from(TradeArea)) or 0,
            "store_metrics": session.scalar(select(func.count()).select_from(StoreMetric)) or 0,
            "sales_metrics": session.scalar(select(func.count()).select_from(SalesMetric)) or 0,
            "population_metrics": session.scalar(select(func.count()).select_from(PopulationMetric)) or 0,
            "data_sources": session.scalar(select(func.count()).select_from(DataSource)) or 0,
        }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url")
    args = parser.parse_args()
    print(json.dumps(load(args.database_url), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

