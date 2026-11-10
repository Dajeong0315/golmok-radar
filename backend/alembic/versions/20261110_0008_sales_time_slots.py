"""Add time-slot sales amounts to sales_metrics (Phase 41).

Existing rows stay NULL until the quarter is reloaded, so the API reports
"비교 불가" instead of inventing zero values.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261110_0008"
down_revision: Union[str, None] = "20261104_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SLOTS = ("00_06", "06_11", "11_14", "14_17", "17_21", "21_24")


def upgrade() -> None:
    with op.batch_alter_table("sales_metrics") as batch:
        for slot in SLOTS:
            batch.add_column(sa.Column(f"sales_{slot}", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("sales_metrics") as batch:
        for slot in reversed(SLOTS):
            batch.drop_column(f"sales_{slot}")
