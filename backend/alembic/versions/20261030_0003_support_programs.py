"""K-Startup 모집 공고 정규화 테이블."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261030_0003"
down_revision: Union[str, None] = "20261030_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "support_programs",
        sa.Column("program_id", sa.String(50), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("application_start", sa.Date(), nullable=False),
        sa.Column("application_end", sa.Date(), nullable=False),
        sa.Column("regions", sa.JSON(), nullable=False),
        sa.Column("stages", sa.JSON(), nullable=False),
        sa.Column("minimum_age", sa.Integer()),
        sa.Column("maximum_age", sa.Integer()),
        sa.Column("maximum_years_in_business", sa.Integer()),
        sa.Column("source_url", sa.String(500), nullable=False),
        sa.Column("support_type", sa.String(255), nullable=False),
        sa.Column("target_text", sa.Text(), nullable=False),
        sa.Column("region_text", sa.Text(), nullable=False),
        sa.Column("business_age_text", sa.Text(), nullable=False),
        sa.Column("age_text", sa.Text(), nullable=False),
        sa.Column("unparsed_conditions", sa.JSON(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_support_programs_application_start", "support_programs", ["application_start"])
    op.create_index("ix_support_programs_application_end", "support_programs", ["application_end"])


def downgrade() -> None:
    op.drop_index("ix_support_programs_application_end", table_name="support_programs")
    op.drop_index("ix_support_programs_application_start", table_name="support_programs")
    op.drop_table("support_programs")
