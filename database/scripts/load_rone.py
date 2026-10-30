"""수집한 R-ONE 서울 소규모상가 참고 벤치마크를 서비스 DB에 적재한다."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app.db import make_engine  # noqa: E402
from app.models import DataSource, RentBenchmark  # noqa: E402
from app.rone import RONE_TABLES, latest_region_benchmark  # noqa: E402


RAW_DIR = ROOT / "database" / "raw" / "rone"


def latest_meta() -> Path:
    matches = sorted(RAW_DIR.glob("rone_small_retail_*.meta.json"))
    if not matches:
        raise FileNotFoundError("database/raw/rone에 R-ONE 메타데이터가 없습니다. fetch_rone.py를 먼저 실행하세요.")
    return matches[-1]


def collect_rows(meta_path: Path | None = None) -> tuple[list[RentBenchmark], DataSource]:
    meta_path = meta_path or latest_meta()
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    fetched_at = datetime.fromisoformat(meta["fetched_at"])
    specs = {spec.metric_key: spec for spec in RONE_TABLES}
    benchmarks: list[RentBenchmark] = []
    for item in meta["files"]:
        spec = specs[item["metric_key"]]
        payload = json.loads((RAW_DIR / item["file"]).read_text(encoding="utf-8"))
        parsed = latest_region_benchmark(payload, spec)
        benchmarks.append(RentBenchmark(**parsed, fetched_at=fetched_at))

    periods = sorted({row.period_label for row in benchmarks})
    source = DataSource(
        key="rone_commercial_rent",
        dataset_name=meta["dataset"],
        provider=meta["provider"],
        source_file=meta_path.name,
        fetched_at=fetched_at,
        notes=f"소규모상가 서울 전체 참고 벤치마크; periods={','.join(periods)}; 정확 상권 조인 아님",
    )
    return benchmarks, source


def load(database_url: str | None = None) -> dict[str, int]:
    engine = make_engine(database_url)
    benchmarks, source = collect_rows()
    with Session(engine) as session, session.begin():
        session.execute(delete(RentBenchmark))
        session.execute(delete(DataSource).where(DataSource.key == source.key))
        session.add_all(benchmarks)
        session.add(source)
    with Session(engine) as session:
        return {"rent_benchmarks": session.scalar(select(func.count()).select_from(RentBenchmark)) or 0}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url")
    args = parser.parse_args()
    print(json.dumps(load(args.database_url), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
