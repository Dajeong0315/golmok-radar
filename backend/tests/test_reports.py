from sqlalchemy.orm import Session

from app.db import Base, make_engine
from app.models import PopulationMetric, SalesMetric, StoreMetric, TradeArea
from app.reports import build_area_report


def test_report_classifies_relative_strengths_cautions_and_context() -> None:
    engine = make_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        for index in range(1, 5):
            code = str(index)
            session.add(TradeArea(code=code, name=code, district_code="", district_name="성동구", area_type_code="", area_type_name="골목상권", x_epsg5181=0, y_epsg5181=0, longitude=0, latitude=0))
            session.add(StoreMetric(quarter_code="20254", trade_area_code=code, industry_code="CS100010", industry_name="커피", store_count=index * 10, opening_rate=index, closing_rate=index))
            session.add(SalesMetric(quarter_code="20254", trade_area_code=code, industry_code="CS100010", industry_name="커피", sales_amount=index * 1000, sales_count=10, weekday_sales_amount=index * 600, weekend_sales_amount=index * 400))
            session.add(PopulationMetric(quarter_code="20254", trade_area_code=code, total_population=index * 1000, population_00_06=index * 100, population_06_11=index * 200, population_11_14=index * 100, population_14_17=index * 200, population_17_21=index * 300, population_21_24=index * 100))
    with Session(engine) as session:
        report = build_area_report(session, "4")
        assert report is not None
        assert report["comparison_count"] == 4
        assert any(item["metric_key"] == "sales_amount" for item in report["strengths"])
        assert any(item["metric_key"] == "closing_rate" for item in report["cautions"])
        assert any(item["metric_key"] == "store_count" for item in report["characteristics"])
