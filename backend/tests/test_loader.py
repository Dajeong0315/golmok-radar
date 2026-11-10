from pathlib import Path

import pytest


RAW = Path(__file__).resolve().parents[2] / "database" / "raw"
REQUIRED_RAW = ("area/*.zip", "store/*_2025년.zip", "sales/*_2025년.zip", "population/*.csv", "population/*.meta.json")
MISSING_RAW = [pattern for pattern in REQUIRED_RAW if not any(RAW.glob(pattern))]
pytestmark = pytest.mark.skipif(
    bool(MISSING_RAW),
    reason=f"Git에서 제외한 원천 파일이 모두 있을 때만 적재 통합 테스트를 실행합니다. 없음: {', '.join(MISSING_RAW)}",
)


def test_loader_imports_expected_counts(tmp_path: Path) -> None:
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from app.db import make_engine
    from app.models import SalesMetric, StoreMetric
    from database.scripts.load_data import load
    from database.scripts.validate_phase1 import DISTRICTS

    counts = load(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")

    assert len(DISTRICTS) == 25
    assert counts == {
        "trade_areas": 1650,
        "store_metrics": 75985,
        "sales_metrics": 21333,
        "population_metrics": 1648,
        "data_sources": 4,
    }
    with Session(make_engine(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")) as session:
        assert session.scalar(select(func.count(func.distinct(StoreMetric.industry_code)))) == 100
        assert session.scalar(select(func.count(func.distinct(SalesMetric.industry_code)))) == 62
        assert session.scalar(select(func.count()).select_from(StoreMetric).where(StoreMetric.industry_code == "CS100010")) == 1518
        assert session.scalar(select(func.count()).select_from(SalesMetric).where(SalesMetric.industry_code == "CS100010")) == 1069


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


def test_loader_preserves_account_favorite_on_reload(tmp_path: Path) -> None:
    from sqlalchemy import text

    from app.db import make_engine
    from database.scripts.load_data import load

    database_url = f"sqlite:///{(tmp_path / 'favorite.db').as_posix()}"
    first = load(database_url)
    engine = make_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE user_favorites (user_id TEXT, trade_area_code TEXT REFERENCES trade_areas(code))"))
        connection.execute(text("INSERT INTO user_favorites VALUES ('test-user', '3120052')"))
    assert load(database_url) == first
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM user_favorites")).scalar_one() == 1

