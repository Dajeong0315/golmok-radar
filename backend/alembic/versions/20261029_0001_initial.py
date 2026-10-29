"""초기 상권 지표 스키마."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261029_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trade_areas",
        sa.Column("code", sa.String(10), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("district_code", sa.String(5), nullable=False),
        sa.Column("district_name", sa.String(40), nullable=False),
        sa.Column("area_type_code", sa.String(2), nullable=False),
        sa.Column("area_type_name", sa.String(40), nullable=False),
        sa.Column("x_epsg5181", sa.Float(), nullable=False),
        sa.Column("y_epsg5181", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
    )
    op.create_index("ix_trade_areas_district_code", "trade_areas", ["district_code"])
    op.create_index("ix_trade_areas_district_name", "trade_areas", ["district_name"])

    op.create_table(
        "store_metrics",
        sa.Column("quarter_code", sa.String(5), primary_key=True),
        sa.Column("trade_area_code", sa.String(10), sa.ForeignKey("trade_areas.code"), primary_key=True),
        sa.Column("industry_code", sa.String(20), primary_key=True),
        sa.Column("industry_name", sa.String(100), nullable=False),
        sa.Column("store_count", sa.Integer(), nullable=False),
        sa.Column("opening_rate", sa.Float()),
        sa.Column("closing_rate", sa.Float()),
    )
    op.create_table(
        "sales_metrics",
        sa.Column("quarter_code", sa.String(5), primary_key=True),
        sa.Column("trade_area_code", sa.String(10), sa.ForeignKey("trade_areas.code"), primary_key=True),
        sa.Column("industry_code", sa.String(20), primary_key=True),
        sa.Column("industry_name", sa.String(100), nullable=False),
        sa.Column("sales_amount", sa.BigInteger(), nullable=False),
        sa.Column("sales_count", sa.BigInteger(), nullable=False),
        sa.Column("weekday_sales_amount", sa.BigInteger(), nullable=False),
        sa.Column("weekend_sales_amount", sa.BigInteger(), nullable=False),
    )
    op.create_table(
        "population_metrics",
        sa.Column("quarter_code", sa.String(5), primary_key=True),
        sa.Column("trade_area_code", sa.String(10), sa.ForeignKey("trade_areas.code"), primary_key=True),
        sa.Column("total_population", sa.BigInteger(), nullable=False),
        sa.Column("population_00_06", sa.BigInteger(), nullable=False),
        sa.Column("population_06_11", sa.BigInteger(), nullable=False),
        sa.Column("population_11_14", sa.BigInteger(), nullable=False),
        sa.Column("population_14_17", sa.BigInteger(), nullable=False),
        sa.Column("population_17_21", sa.BigInteger(), nullable=False),
        sa.Column("population_21_24", sa.BigInteger(), nullable=False),
    )
    op.create_table(
        "data_sources",
        sa.Column("key", sa.String(50), primary_key=True),
        sa.Column("dataset_name", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(255), nullable=False),
        sa.Column("source_file", sa.String(255), nullable=False),
        sa.Column("fetched_at", sa.DateTime()),
        sa.Column("quarter_min", sa.String(5)),
        sa.Column("quarter_max", sa.String(5)),
        sa.Column("notes", sa.Text()),
    )


def downgrade() -> None:
    op.drop_table("data_sources")
    op.drop_table("population_metrics")
    op.drop_table("sales_metrics")
    op.drop_table("store_metrics")
    op.drop_index("ix_trade_areas_district_name", table_name="trade_areas")
    op.drop_index("ix_trade_areas_district_code", table_name="trade_areas")
    op.drop_table("trade_areas")

