"""R-ONE 임대시장 참고 벤치마크."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261030_0002"
down_revision: Union[str, None] = "20261029_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rent_benchmarks",
        sa.Column("period_code", sa.String(10), primary_key=True),
        sa.Column("region_code", sa.String(20), primary_key=True),
        sa.Column("building_type", sa.String(40), primary_key=True),
        sa.Column("metric_key", sa.String(40), primary_key=True),
        sa.Column("period_label", sa.String(40), nullable=False),
        sa.Column("region_name", sa.String(100), nullable=False),
        sa.Column("metric_label", sa.String(100), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(40), nullable=False),
        sa.Column("table_id", sa.String(40), nullable=False),
        sa.Column("item_id", sa.String(40), nullable=False),
        sa.Column("mapping_scope", sa.String(40), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.Column("source_url", sa.String(500), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("rent_benchmarks")
