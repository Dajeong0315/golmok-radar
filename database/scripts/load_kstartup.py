"""수집한 K-Startup 모집 공고를 서비스 DB에 정규화해 적재한다."""
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
from app.models import DataSource, SupportProgram  # noqa: E402
from app.support_programs import normalize_program, response_rows  # noqa: E402


RAW_DIR = ROOT / "database" / "raw" / "kstartup"


def latest_meta() -> Path:
    matches = sorted(RAW_DIR.glob("kstartup_announcements_*.meta.json"))
    if not matches:
        raise FileNotFoundError("database/raw/kstartup에 메타데이터가 없습니다. fetch_kstartup.py를 먼저 실행하세요.")
    return matches[-1]


def collect_rows(meta_path: Path | None = None) -> tuple[list[SupportProgram], DataSource]:
    meta_path = meta_path or latest_meta()
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    fetched_at = datetime.fromisoformat(meta["fetched_at"])
    programs: dict[str, SupportProgram] = {}
    for page in meta["pages"]:
        payload = json.loads((RAW_DIR / page["file"]).read_text(encoding="utf-8-sig"))
        for raw in response_rows(payload):
            item = normalize_program(raw)
            programs[item.program_id] = SupportProgram(
                program_id=item.program_id,
                title=item.title,
                application_start=item.application_start,
                application_end=item.application_end,
                regions=list(item.regions),
                stages=list(item.stages),
                minimum_age=item.minimum_age,
                maximum_age=item.maximum_age,
                maximum_years_in_business=item.maximum_years_in_business,
                source_url=item.source_url,
                support_type=item.support_type,
                target_text=item.target_text,
                region_text=item.region_text,
                business_age_text=item.business_age_text,
                age_text=item.age_text,
                unparsed_conditions=list(item.unparsed_conditions),
                fetched_at=fetched_at,
            )
    source = DataSource(
        key="kstartup_announcements",
        dataset_name=meta["dataset"],
        provider=meta["provider"],
        source_file=meta_path.name,
        fetched_at=fetched_at,
        notes=f"모집진행여부 Y 필터; normalized_count={len(programs)}; 원문 상세 조건은 사용자 확인",
    )
    return list(programs.values()), source


def load(database_url: str | None = None) -> dict[str, int]:
    engine = make_engine(database_url)
    programs, source = collect_rows()
    with Session(engine) as session, session.begin():
        session.execute(delete(SupportProgram))
        session.execute(delete(DataSource).where(DataSource.key == source.key))
        session.add_all(programs)
        session.add(source)
    with Session(engine) as session:
        return {"support_programs": session.scalar(select(func.count()).select_from(SupportProgram)) or 0}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url")
    args = parser.parse_args()
    print(json.dumps(load(args.database_url), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
