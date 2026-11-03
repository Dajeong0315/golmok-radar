"""계정별 테스트·리포트 기록과 익명 이관 배치.

RLS는 Supabase 인증 사용자만 자신의 기록을 읽고 쓸 수 있게 제한한다.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261103_0005"
down_revision: Union[str, None] = "20261102_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_records",
        sa.Column("record_id", sa.String(100), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False, index=True),
        sa.Column("kind", sa.String(40), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("source_batch_id", sa.String(100), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("user_id", "source_batch_id", "kind", name="uq_user_records_transfer_source"),
    )
    if op.get_bind().dialect.name == "postgresql":
        op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_records TO authenticated")
        op.execute("ALTER TABLE public.user_records ENABLE ROW LEVEL SECURITY")
        op.execute("CREATE POLICY user_records_owner ON public.user_records FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id)")


def downgrade() -> None:
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP POLICY IF EXISTS user_records_owner ON public.user_records")
    op.drop_table("user_records")
