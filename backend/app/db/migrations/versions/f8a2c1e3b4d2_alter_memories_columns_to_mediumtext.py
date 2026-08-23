"""alter_memories_columns_to_mediumtext

Revision ID: f8a2c1e3b4d2
Revises: ab4774dd04e0
Create Date: 2026-08-19 14:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.mysql import MEDIUMTEXT


# revision identifiers, used by Alembic.
revision: str = 'f8a2c1e3b4d2'
down_revision: Union[str, Sequence[str], None] = 'ab4774dd04e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change memories_updated and memories_used from TEXT to MEDIUMTEXT."""
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        op.alter_column(
            'messages', 'memories_updated',
            existing_type=sa.Text(),
            type_=MEDIUMTEXT(),
            existing_nullable=True,
        )
        op.alter_column(
            'messages', 'memories_used',
            existing_type=sa.Text(),
            type_=MEDIUMTEXT(),
            existing_nullable=True,
        )


def downgrade() -> None:
    """Revert MEDIUMTEXT back to TEXT."""
    bind = op.get_bind()
    if bind.dialect.name == 'mysql':
        op.alter_column(
            'messages', 'memories_updated',
            existing_type=MEDIUMTEXT(),
            type_=sa.Text(),
            existing_nullable=True,
        )
        op.alter_column(
            'messages', 'memories_used',
            existing_type=MEDIUMTEXT(),
            type_=sa.Text(),
            existing_nullable=True,
        )
