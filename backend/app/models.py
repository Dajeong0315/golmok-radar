from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, BigInteger, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class TradeArea(Base):
    __tablename__ = "trade_areas"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    district_code: Mapped[str] = mapped_column(String(5), nullable=False, index=True)
    district_name: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    area_type_code: Mapped[str] = mapped_column(String(2), nullable=False)
    area_type_name: Mapped[str] = mapped_column(String(40), nullable=False)
    x_epsg5181: Mapped[float] = mapped_column(Float, nullable=False)
    y_epsg5181: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)

    store_metrics: Mapped[list[StoreMetric]] = relationship(back_populates="trade_area")
    sales_metrics: Mapped[list[SalesMetric]] = relationship(back_populates="trade_area")
    population_metrics: Mapped[list[PopulationMetric]] = relationship(back_populates="trade_area")


class StoreMetric(Base):
    __tablename__ = "store_metrics"

    quarter_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    trade_area_code: Mapped[str] = mapped_column(ForeignKey("trade_areas.code"), primary_key=True)
    industry_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    industry_name: Mapped[str] = mapped_column(String(100), nullable=False)
    store_count: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_rate: Mapped[float | None] = mapped_column(Float)
    closing_rate: Mapped[float | None] = mapped_column(Float)

    trade_area: Mapped[TradeArea] = relationship(back_populates="store_metrics")


class SalesMetric(Base):
    __tablename__ = "sales_metrics"

    quarter_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    trade_area_code: Mapped[str] = mapped_column(ForeignKey("trade_areas.code"), primary_key=True)
    industry_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    industry_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sales_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sales_count: Mapped[int] = mapped_column(BigInteger, nullable=False)
    weekday_sales_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    weekend_sales_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)

    trade_area: Mapped[TradeArea] = relationship(back_populates="sales_metrics")


class PopulationMetric(Base):
    __tablename__ = "population_metrics"

    quarter_code: Mapped[str] = mapped_column(String(5), primary_key=True)
    trade_area_code: Mapped[str] = mapped_column(ForeignKey("trade_areas.code"), primary_key=True)
    total_population: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_00_06: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_06_11: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_11_14: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_14_17: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_17_21: Mapped[int] = mapped_column(BigInteger, nullable=False)
    population_21_24: Mapped[int] = mapped_column(BigInteger, nullable=False)

    trade_area: Mapped[TradeArea] = relationship(back_populates="population_metrics")


class DataSource(Base):
    __tablename__ = "data_sources"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    dataset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    source_file: Mapped[str] = mapped_column(String(255), nullable=False)
    fetched_at: Mapped[datetime | None] = mapped_column(DateTime)
    quarter_min: Mapped[str | None] = mapped_column(String(5))
    quarter_max: Mapped[str | None] = mapped_column(String(5))
    notes: Mapped[str | None] = mapped_column(Text)


class RentBenchmark(Base):
    __tablename__ = "rent_benchmarks"

    period_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    region_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    building_type: Mapped[str] = mapped_column(String(40), primary_key=True)
    metric_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    period_label: Mapped[str] = mapped_column(String(40), nullable=False)
    region_name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric_label: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    table_id: Mapped[str] = mapped_column(String(40), nullable=False)
    item_id: Mapped[str] = mapped_column(String(40), nullable=False)
    mapping_scope: Mapped[str] = mapped_column(String(40), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)


class SupportProgram(Base):
    __tablename__ = "support_programs"

    program_id: Mapped[str] = mapped_column(String(50), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    application_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    application_end: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    regions: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    stages: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    minimum_age: Mapped[int | None] = mapped_column(Integer)
    maximum_age: Mapped[int | None] = mapped_column(Integer)
    maximum_years_in_business: Mapped[int | None] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(String(500), nullable=False)
    support_type: Mapped[str] = mapped_column(String(255), nullable=False)
    target_text: Mapped[str] = mapped_column(Text, nullable=False)
    region_text: Mapped[str] = mapped_column(Text, nullable=False)
    business_age_text: Mapped[str] = mapped_column(Text, nullable=False)
    age_text: Mapped[str] = mapped_column(Text, nullable=False)
    unparsed_conditions: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

