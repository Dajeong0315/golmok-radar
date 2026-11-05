"""Prevent account records from surviving or being recreated after Auth deletion."""

from typing import Sequence, Union

from alembic import op


revision: str = "20261104_0007"
down_revision: Union[str, None] = "20261103_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLES = ("user_favorites", "property_worksheets", "user_records")


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"DROP POLICY {table}_owner ON public.{table}")
        op.execute(f"ALTER TABLE public.{table} ALTER COLUMN user_id TYPE uuid USING user_id::uuid")
        op.execute(f"ALTER TABLE public.{table} ADD CONSTRAINT fk_{table}_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE")
        op.execute(f"CREATE POLICY {table}_owner ON public.{table} FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in reversed(TABLES):
        op.execute(f"DROP POLICY {table}_owner ON public.{table}")
        op.execute(f"ALTER TABLE public.{table} DROP CONSTRAINT fk_{table}_auth_user")
        op.execute(f"ALTER TABLE public.{table} ALTER COLUMN user_id TYPE varchar(36) USING user_id::text")
        op.execute(f"CREATE POLICY {table}_owner ON public.{table} FOR ALL USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id)")
