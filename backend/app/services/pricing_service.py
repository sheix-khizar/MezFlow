from decimal import Decimal
from typing import List, Tuple, Dict
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.menu import MenuItem, ModifierOption, ItemModifierGroup


async def validate_and_compute_item_price(
    db: AsyncSession,
    item_id: UUID,
    selected_modifier_option_ids: List[UUID],
) -> Tuple[MenuItem, List[ModifierOption], Decimal]:
    """
    Server-authoritative price calculation (NFR-06).
    Strictly queries current database prices. Any client-sent prices are discarded.
    Validates availability (rejects 86ed items) and modifier selection bounds.
    """
    # 1. Fetch MenuItem
    item_query = select(MenuItem).where(MenuItem.id == item_id)
    item_res = await db.execute(item_query)
    item = item_res.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu dish not found.",
        )

    if not item.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{item.name}' is currently sold out.",
        )

    base_price = Decimal(str(item.price))

    # 2. Fetch Modifier Options and Groups
    selected_options: List[ModifierOption] = []
    modifiers_delta = Decimal("0.00")

    if selected_modifier_option_ids:
        opt_query = (
            select(ModifierOption)
            .join(ItemModifierGroup, ModifierOption.group_id == ItemModifierGroup.id)
            .where(
                ModifierOption.id.in_(selected_modifier_option_ids),
                ItemModifierGroup.item_id == item_id,
            )
        )
        opt_res = await db.execute(opt_query)
        selected_options = list(opt_res.scalars().all())

        if len(selected_options) != len(set(selected_modifier_option_ids)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more selected modifier options are invalid for this dish.",
            )

        for opt in selected_options:
            if not opt.is_available:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Modifier option '{opt.name}' is currently unavailable.",
                )
            modifiers_delta += Decimal(str(opt.price_delta))

    # 3. Validate Modifier Group Bounds (min_selections & max_selections)
    grp_query = select(ItemModifierGroup).where(ItemModifierGroup.item_id == item_id)
    grp_res = await db.execute(grp_query)
    groups = grp_res.scalars().all()

    options_by_group: Dict[UUID, int] = {}
    for opt in selected_options:
        options_by_group[opt.group_id] = options_by_group.get(opt.group_id, 0) + 1

    for grp in groups:
        count = options_by_group.get(grp.id, 0)
        if grp.is_required and count < grp.min_selections:
            raise HTTPException(
                status_code=422,
                detail=f"Please select required option for '{grp.name}'. (Minimum: {grp.min_selections})",
            )
        if grp.max_selections and count > grp.max_selections:
            raise HTTPException(
                status_code=422,
                detail=f"Too many selections for '{grp.name}'. (Maximum: {grp.max_selections})",
            )

    unit_price = max(Decimal("0.00"), base_price + modifiers_delta)
    return item, selected_options, unit_price
