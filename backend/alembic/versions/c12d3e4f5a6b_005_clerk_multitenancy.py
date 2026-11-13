"""005_clerk_multitenancy

Revision ID: c12d3e4f5a6b
Revises: b94c5e6f7a81
Create Date: 2026-11-13 02:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c12d3e4f5a6b'
down_revision: Union[str, None] = 'b94c5e6f7a81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add clerk_org_id to restaurants
    op.add_column('restaurants', sa.Column('clerk_org_id', sa.String(128), nullable=True))
    op.create_index(op.f('ix_restaurants_clerk_org_id'), 'restaurants', ['clerk_org_id'], unique=True)

    # 2. Add clerk_user_id to users
    op.add_column('users', sa.Column('clerk_user_id', sa.String(128), nullable=True))
    op.create_index(op.f('ix_users_clerk_user_id'), 'users', ['clerk_user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_clerk_user_id'), table_name='users')
    op.drop_column('users', 'clerk_user_id')

    op.drop_index(op.f('ix_restaurants_clerk_org_id'), table_name='restaurants')
    op.drop_column('restaurants', 'clerk_org_id')

