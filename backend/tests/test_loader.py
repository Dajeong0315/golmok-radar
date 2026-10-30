from pathlib import Path

import pytest


RAW_STORE = Path(__file__).resolve().parents[2] / "database" / "raw" / "store"
pytestmark = pytest.mark.skipif(
    not any(RAW_STORE.glob("*.zip")),
    reason="Git에서 제외한 원천 파일이 있을 때만 적재 통합 테스트를 실행합니다.",
)


def test_loader_imports_expected_counts(tmp_path: Path) -> None:
    from database.scripts.load_data import load
    from database.scripts.validate_phase1 import DISTRICTS

    counts = load(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")

    assert len(DISTRICTS) == 25
    assert counts == {
        "trade_areas": 1650,
        "store_metrics": 1518,
        "sales_metrics": 1069,
        "population_metrics": 1648,
        "data_sources": 4,
    }


def test_loader_preserves_non_core_sources(tmp_path: Path) -> None:
    from sqlalchemy.orm import Session

    from app.db import Base, make_engine
    from app.models import DataSource
    from database.scripts.load_data import load

    database_url = f"sqlite:///{(tmp_path / 'preserve.db').as_posix()}"
    engine = make_engine(database_url)
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(DataSource(key="external", dataset_name="외부 자료", provider="테스트", source_file="external.json"))

    counts = load(database_url)

    assert counts["data_sources"] == 5
    with Session(engine) as session:
        assert session.get(DataSource, "external") is not None

