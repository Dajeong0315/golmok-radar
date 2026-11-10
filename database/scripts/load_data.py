"""검증된 상권 데이터를 서비스 DB에 기준분기 단위로 적재한다.

기본 실행 (2025년 4분기, 연도별 ZIP):
    python database/scripts/load_data.py

다른 분기 (연도별 ZIP 또는 fetch_quarter.py로 받은 Open API CSV):
    python database/scripts/load_data.py --quarter 20262

다른 DB 사용:
    python database/scripts/load_data.py --database-url sqlite:///경로.db

적재 전에 database/scripts/data_quality.py 로 같은 분기를 검사한다.
지정한 분기의 점포·매출·유동인구 행만 교체하고 다른 분기 행은 그대로 둔다.
"""

from __future__ import annotations

import argparse
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
from database.scripts.raw_sources import (  # noqa: E402
    POPULATION_FORMATS,
    SALES_FORMATS,
    STORE_FORMATS,
    TIME_SLOTS,
    QuarterFile,
    detect_format,
    iter_csv,
    normalize,
    resolve_quarter_file,
)
from database.scripts.validate_phase1 import (  # noqa: E402
    DISTRICTS,
    QUARTER,
    find_one,
    read_dbf_from_zip,
)

RAW = ROOT / "database" / "raw"


def as_int(value: str) -> int:
    if value in ("", None):
        raise ValueError("필수 원천값이 비어 있습니다.")
    return int(Decimal(value))


def as_float_or_none(value: str) -> float | None:
    return float(value) if value not in ("", None) else None


def normalized_rows(source: QuarterFile, formats: dict[str, dict[str, str]]):
    columns, rows = source.reader()
    name, missing = detect_format(columns, formats)
    if name is None:
        best = min(missing.items(), key=lambda item: len(item[1]))
        raise ValueError(f"{source.path.name}: 필수 컬럼이 없습니다 ({', '.join(best[1])}).")
    return normalize(rows, formats[name])


def quarter_source(kind: str, quarter: str) -> QuarterFile:
    source = resolve_quarter_file(RAW, kind, quarter)
    if source is None:
        raise RuntimeError(f"{kind} 원천이 없습니다: {quarter} 분기 Open API CSV 또는 {quarter[:4]}년 ZIP이 하나 있어야 합니다.")
    return source


def data_source(kind: str, source: QuarterFile, quarter: str) -> DataSource:
    dataset = {"store": "서울시 상권분석서비스(점포-상권)", "sales": "서울시 상권분석서비스(추정매출-상권)"}[kind]
    if source.origin == "zip":
        # 기존 키를 유지한다. 연도별 ZIP은 그해 1~4분기를 담는다.
        return DataSource(
            key=kind, dataset_name=dataset, provider="서울신용보증재단", source_file=source.path.name,
            quarter_min=f"{quarter[:4]}1", quarter_max=f"{quarter[:4]}4",
        )
    meta = json.loads(source.meta_path.read_text(encoding="utf-8")) if source.meta_path else {}
    return DataSource(
        key=f"{kind}:{quarter}", dataset_name=dataset, provider=meta.get("provider", "서울신용보증재단 / 서울 열린데이터광장 Open API"),
        source_file=source.path.name,
        fetched_at=datetime.fromisoformat(meta["fetched_at"]) if meta.get("fetched_at") else None,
        quarter_min=quarter, quarter_max=quarter,
        notes=f"Open API service={meta.get('service')}, rows={meta.get('rows_saved')}",
    )


def collect_rows(quarter: str = QUARTER) -> tuple[list[TradeArea], list[StoreMetric], list[SalesMetric], list[PopulationMetric], list[DataSource]]:
    area_zip = find_one("database/raw/area/*.zip")
    store_source = quarter_source("store", quarter)
    sales_source = quarter_source("sales", quarter)
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
    for row in normalized_rows(store_source, STORE_FORMATS):
        if row["quarter"] != quarter:
            continue
        if row["area"] not in area_codes:
            raise ValueError("점포 원천의 상권 코드가 공식 영역에 없습니다.")
        key = (quarter, row["area"], row["industry"])
        if key in store_keys:
            raise ValueError(f"점포 논리 키 중복: {key}")
        store_keys.add(key)
        name = row["industry_name"]
        if row["industry"] in store_industries and store_industries[row["industry"]] != name:
            raise ValueError(f"점포 업종명 불일치: {row['industry']}")
        store_industries[row["industry"]] = name
        store_metrics.append(
            StoreMetric(
                quarter_code=quarter,
                trade_area_code=row["area"],
                industry_code=row["industry"],
                industry_name=name,
                store_count=as_int(row["store_count"]),
                opening_rate=as_float_or_none(row["opening_rate"]),
                closing_rate=as_float_or_none(row["closing_rate"]),
            )
        )

    sales_metrics: list[SalesMetric] = []
    sales_keys: set[tuple[str, str, str]] = set()
    sales_industries: dict[str, str] = {}
    for row in normalized_rows(sales_source, SALES_FORMATS):
        if row["quarter"] != quarter:
            continue
        if row["area"] not in area_codes:
            raise ValueError("매출 원천의 상권 코드가 공식 영역에 없습니다.")
        key = (quarter, row["area"], row["industry"])
        if key in sales_keys:
            raise ValueError(f"매출 논리 키 중복: {key}")
        sales_keys.add(key)
        name = row["industry_name"]
        if row["industry"] in sales_industries and sales_industries[row["industry"]] != name:
            raise ValueError(f"매출 업종명 불일치: {row['industry']}")
        sales_industries[row["industry"]] = name
        sales_metrics.append(
            SalesMetric(
                quarter_code=quarter,
                trade_area_code=row["area"],
                industry_code=row["industry"],
                industry_name=name,
                sales_amount=as_int(row["sales_amount"]),
                sales_count=as_int(row["sales_count"]),
                weekday_sales_amount=as_int(row["weekday_sales_amount"]),
                weekend_sales_amount=as_int(row["weekend_sales_amount"]),
                **{f"sales_{slot}": as_int(row[f"sales_{slot}"]) for slot in TIME_SLOTS},
            )
        )
    if not set(sales_industries).issubset(store_industries):
        raise ValueError("매출 업종 코드가 점포 원천에 없습니다.")
    if not store_metrics or not sales_metrics:
        raise ValueError(f"기준분기 {quarter}의 점포 또는 매출 행이 없습니다.")

    population_metrics: list[PopulationMetric] = []
    columns, population_rows = iter_csv(population_csv)
    population_format, missing = detect_format(columns, POPULATION_FORMATS)
    if population_format is None:
        raise ValueError(f"유동인구 필수 컬럼이 없습니다 ({', '.join(missing['open_api'])}).")
    for row in normalize(population_rows, POPULATION_FORMATS[population_format]):
        if row["quarter"] == quarter and row["area"] in area_codes:
            population_metrics.append(
                PopulationMetric(
                    quarter_code=quarter,
                    trade_area_code=row["area"],
                    total_population=as_int(row["total_population"]),
                    **{f"population_{slot}": as_int(row[f"population_{slot}"]) for slot in TIME_SLOTS},
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
        data_source("store", store_source, quarter),
        data_source("sales", sales_source, quarter),
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


def load(database_url: str | None = None, quarter: str = QUARTER) -> dict[str, int]:
    engine = make_engine(database_url)
    if engine.url.get_backend_name() == "sqlite" and engine.url.database not in (None, ":memory:"):
        Path(engine.url.database).parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(engine)

    trade_areas, stores, sales, populations, sources = collect_rows(quarter)
    with Session(engine) as session, session.begin():
        for model in (PopulationMetric, SalesMetric, StoreMetric):
            session.execute(delete(model).where(model.quarter_code == quarter))
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
    parser.add_argument("--quarter", default=QUARTER, help="적재할 기준분기 (예: 20262)")
    args = parser.parse_args()
    print(json.dumps(load(args.database_url, args.quarter), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

