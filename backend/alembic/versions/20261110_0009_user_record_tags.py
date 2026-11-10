"""Add owner-managed tags to account records (Phase 43).

Tags live on the same row, so the existing owner-only RLS policy and the
account deletion lifecycle cover them without new rules.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20261110_0009"
down_revision: Union[str, None] = "20261110_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_records") as batch:
        batch.add_column(sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))


def downgrade() -> None:
    with op.batch_alter_table("user_records") as batch:
        batch.drop_column("tags")
