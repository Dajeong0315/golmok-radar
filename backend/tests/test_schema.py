from sqlalchemy import inspect

from app.db import Base, make_engine
from app import models  # noqa: F401


def test_schema_is_created_in_sqlite() -> None:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    assert set(inspect(engine).get_table_names()) == {
        "data_sources",
        "population_metrics",
        "sales_metrics",
        "store_metrics",
        "trade_areas",
    }

