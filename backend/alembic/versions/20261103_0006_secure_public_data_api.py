"""Protect public-schema tables before enabling Supabase Data API.

The frontend reads official market statistics through FastAPI, not PostgREST.
RLS is therefore deliberately enabled without public policies on those tables.
The account-record tables retain their owner policies from earlier revisions.
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20261103_0006"
down_revision: Union[str, None] = "20261103_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DATA_API_DENY_BY_DEFAULT_TABLES = (
    "alembic_version",
    "data_sources",
    "population_metrics",
    "rent_benchmarks",
    "sales_metrics",
    "store_metrics",
    "support_programs",
    "trade_areas",
)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in DATA_API_DENY_BY_DEFAULT_TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in DATA_API_DENY_BY_DEFAULT_TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
