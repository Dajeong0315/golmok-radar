from sqlalchemy.orm import Session

from app.db import Base, make_engine
from app.metric_service import get_all_area_metrics, get_area_metrics
from app.models import PopulationMetric, TradeArea


def test_missing_sales_is_unavailable_not_zero() -> None:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(
            TradeArea(
                code="1",
                name="테스트 상권",
                district_code="11200",
                district_name="성동구",
                area_type_code="A",
                area_type_name="골목상권",
                x_epsg5181=200000,
                y_epsg5181=450000,
                longitude=127.0,
                latitude=37.5,
            )
        )
        session.add(
            PopulationMetric(
                quarter_code="20254",
                trade_area_code="1",
                total_population=1_000,
                population_00_06=100,
                population_06_11=200,
                population_11_14=100,
                population_14_17=200,
                population_17_21=300,
                population_21_24=100,
            )
        )

    with Session(engine) as session:
        _, metrics = get_area_metrics(session, "1", "20254")

    values = {metric.metric_key: metric for metric in metrics}
    assert values["sales_amount"].status == "unavailable"
    assert values["sales_amount"].value is None
    assert values["weekend_sales_ratio"].value is None
    assert values["population_17_21_ratio"].value == 30

    with Session(engine) as session:
        bulk = get_all_area_metrics(session, "20254")

    assert len(bulk) == 1
    bulk_values = {metric.metric_key: metric for metric in bulk[0][1]}
    assert bulk_values["sales_amount"].status == "unavailable"
    assert bulk_values["population_17_21_ratio"].value == 30

