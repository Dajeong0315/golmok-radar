"""카카오 계정별 관심 상권과 매물 워크시트 동기화 테이블."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261102_0004"
down_revision: Union[str, None] = "20261030_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_favorites",
        sa.Column("user_id", sa.String(36), primary_key=True),
        sa.Column("trade_area_code", sa.String(10), sa.ForeignKey("trade_areas.code"), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "property_worksheets",
        sa.Column("worksheet_id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False, index=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_favorites TO authenticated")
        op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.property_worksheets TO authenticated")
        op.execute("ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY")
        op.execute("ALTER TABLE public.property_worksheets ENABLE ROW LEVEL SECURITY")
        op.execute("CREATE POLICY user_favorites_owner ON public.user_favorites FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id)")
        op.execute("CREATE POLICY property_worksheets_owner ON public.property_worksheets FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id)")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP POLICY IF EXISTS property_worksheets_owner ON public.property_worksheets")
        op.execute("DROP POLICY IF EXISTS user_favorites_owner ON public.user_favorites")
    op.drop_table("property_worksheets")
    op.drop_table("user_favorites")
