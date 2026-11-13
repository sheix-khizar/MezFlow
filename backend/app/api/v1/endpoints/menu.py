from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_db,
    get_current_user,
    require_manager,
    require_staff,
    enforce_tenant,
)
from app.models.user import User, UserRole
from app.models.menu import MenuCategory, MenuItem, ItemModifierGroup, ModifierOption
from app.schemas.menu import (
    PublicMenuResponse,
    MenuItemDetailResponse,
    MenuItemResponse,
    MenuCategoryResponse,
    MenuItemCreate,
    MenuItemUpdate,
    MenuCategoryCreate,
    MenuCategoryUpdate,
    ModifierGroupCreate,
    ModifierGroupUpdate,
    ModifierGroupResponse,
    ModifierOptionCreate,
    ModifierOptionUpdate,
    ModifierOptionResponse,
    AvailabilityToggleRequest,
)
from app.services.menu_service import (
    get_public_menu,
    get_menu_item_detail,
    search_menu_items,
    set_item_availability,
)
from app.services.realtime import menu_connection_manager
from app.services.audit import record_audit_log

router = APIRouter()


# =============================================================================
# PUBLIC DINER ENDPOINTS (Zero Authentication Required)
# =============================================================================

@router.get(
    "/restaurants/{restaurant_id}/menu",
    response_model=PublicMenuResponse,
    tags=["Public Digital Menu"],
    summary="Get complete hierarchical digital menu for customer PWA",
)
async def get_menu(
    restaurant_id: UUID,
    lang: str = Query("en", description="Language code: 'en' for English, 'ur' for Urdu"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns active menu categories, dishes, prices, badges, and modifier groups.
    (FR-M2-02, FR-M2-03, FR-M2-06, NFR-01)
    """
    return await get_public_menu(db, restaurant_id, lang=lang)


@router.get(
    "/restaurants/{restaurant_id}/menu/items/{item_id}",
    response_model=MenuItemDetailResponse,
    tags=["Public Digital Menu"],
    summary="Get single dish specification with complete modifier choices",
)
async def get_item_detail(
    restaurant_id: UUID,
    item_id: UUID,
    lang: str = Query("en", description="Language code: 'en' or 'ur'"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns dish details, structured AI attributes, and full modifier options with price deltas.
    (FR-M2-03, FR-M2-05, NFR-06)
    """
    return await get_menu_item_detail(db, restaurant_id, item_id)


@router.get(
    "/restaurants/{restaurant_id}/menu/search",
    response_model=List[MenuItemDetailResponse],
    tags=["Public Digital Menu"],
    summary="Search dishes by English/Urdu name, station, or dietary tags",
)
async def search_menu(
    restaurant_id: UUID,
    q: Optional[str] = Query(None, description="Search term in English or Urdu"),
    category_id: Optional[UUID] = Query(None),
    station: Optional[str] = Query(None),
    dietary: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Instant search and filtering across menu items.
    (FR-M2-02, FR-M2-05)
    """
    return await search_menu_items(
        db=db,
        restaurant_id=restaurant_id,
        q=q,
        category_id=category_id,
        station=station,
        dietary=dietary,
    )


# =============================================================================
# AVAILABILITY TOGGLE (Instant 86ing - Manager & Kitchen Staff)
# =============================================================================

@router.patch(
    "/menu/items/{item_id}/availability",
    response_model=MenuItemResponse,
    tags=["Menu Administration"],
    summary="Instant 86 toggle: mark dish available or sold out with sub-2s broadcast",
)
async def toggle_availability(
    item_id: UUID,
    data: AvailabilityToggleRequest,
    request: Request,
    current_user: User = Depends(require_staff()),
    db: AsyncSession = Depends(get_db),
):
    """
    Toggles the is_available boolean for a menu item.
    Immediately broadcasts the change across WebSockets to all active diners in < 2 seconds.
    (FR-M2-04, NFR-02)
    """
    # Enforce item belongs to current_user's restaurant
    item = await set_item_availability(
        db=db,
        restaurant_id=current_user.restaurant_id,
        item_id=item_id,
        is_available=data.is_available,
    )

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    await record_audit_log(
        db=db,
        restaurant_id=current_user.restaurant_id,
        user_id=current_user.id,
        action="MENU_ITEM_AVAILABILITY_TOGGLED",
        resource_type="menu_item",
        resource_id=str(item.id),
        details={"name": item.name, "is_available": item.is_available},
        ip_address=ip,
    )
    await db.commit()

    return MenuItemResponse.model_validate(item)


# =============================================================================
# CATEGORY ADMINISTRATION (Manager Only)
# =============================================================================

@router.post(
    "/menu/categories",
    response_model=MenuCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Menu Administration"],
    summary="Create a new menu category",
)
async def create_category(
    data: MenuCategoryCreate,
    request: Request,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new menu category with optional Urdu translation and icon."""
    category = MenuCategory(
        restaurant_id=current_user.restaurant_id,
        name=data.name,
        name_ur=data.name_ur,
        description=data.description,
        description_ur=data.description_ur,
        icon_name=data.icon_name,
        sort_order=data.sort_order,
        is_active=data.is_active,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)

    # Real-time notification
    await menu_connection_manager.publish_event(
        restaurant_id=current_user.restaurant_id,
        event_data={
            "event": "CATEGORY_UPDATED",
            "category_id": str(category.id),
            "name": category.name,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return MenuCategoryResponse(
        id=category.id,
        restaurant_id=category.restaurant_id,
        name=category.name,
        name_ur=category.name_ur,
        description=category.description,
        description_ur=category.description_ur,
        icon_name=category.icon_name,
        sort_order=category.sort_order,
        is_active=category.is_active,
        items=[],
        created_at=category.created_at,
    )


@router.patch(
    "/menu/categories/{category_id}",
    response_model=MenuCategoryResponse,
    tags=["Menu Administration"],
    summary="Update a menu category",
)
async def update_category(
    category_id: UUID,
    data: MenuCategoryUpdate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Updates category details or sort order."""
    query = select(MenuCategory).where(
        MenuCategory.id == category_id,
        MenuCategory.restaurant_id == current_user.restaurant_id,
    )
    res = await db.execute(query)
    category = res.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)

    await menu_connection_manager.publish_event(
        restaurant_id=current_user.restaurant_id,
        event_data={
            "event": "CATEGORY_UPDATED",
            "category_id": str(category.id),
            "name": category.name,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return MenuCategoryResponse(
        id=category.id,
        restaurant_id=category.restaurant_id,
        name=category.name,
        name_ur=category.name_ur,
        description=category.description,
        description_ur=category.description_ur,
        icon_name=category.icon_name,
        sort_order=category.sort_order,
        is_active=category.is_active,
        items=[],
        created_at=category.created_at,
    )


@router.delete(
    "/menu/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Menu Administration"],
    summary="Deactivate or soft-delete a menu category",
)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Soft-deactivates category."""
    query = select(MenuCategory).where(
        MenuCategory.id == category_id,
        MenuCategory.restaurant_id == current_user.restaurant_id,
    )
    res = await db.execute(query)
    category = res.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found.")

    category.is_active = False
    await db.commit()


# =============================================================================
# DISH / ITEM ADMINISTRATION (Manager Only)
# =============================================================================

@router.post(
    "/menu/items",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Menu Administration"],
    summary="Create a new menu dish",
)
async def create_item(
    data: MenuItemCreate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Creates a new menu dish under the manager's tenant restaurant."""
    # Verify category belongs to same restaurant
    cat_res = await db.execute(
        select(MenuCategory).where(
            MenuCategory.id == data.category_id,
            MenuCategory.restaurant_id == current_user.restaurant_id,
        )
    )
    if not cat_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category_id for this restaurant.")

    item = MenuItem(
        restaurant_id=current_user.restaurant_id,
        category_id=data.category_id,
        name=data.name,
        name_ur=data.name_ur,
        description=data.description,
        description_ur=data.description_ur,
        price=data.price,
        image_url=data.image_url,
        is_available=data.is_available,
        expected_prep_minutes=data.expected_prep_minutes,
        kitchen_station=data.kitchen_station,
        dietary_tags=data.dietary_tags or [],
        sort_order=data.sort_order,
        structured_attributes=data.structured_attributes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    await menu_connection_manager.publish_event(
        restaurant_id=current_user.restaurant_id,
        event_data={
            "event": "MENU_ITEM_UPDATED",
            "item_id": str(item.id),
            "name": item.name,
            "price": float(item.price),
            "is_available": item.is_available,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return MenuItemResponse.model_validate(item)


@router.patch(
    "/menu/items/{item_id}",
    response_model=MenuItemResponse,
    tags=["Menu Administration"],
    summary="Update menu dish details, pricing, station, or structured attributes",
)
async def update_item(
    item_id: UUID,
    data: MenuItemUpdate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Updates a dish and broadcasts changes to active customer screens."""
    query = select(MenuItem).where(
        MenuItem.id == item_id,
        MenuItem.restaurant_id == current_user.restaurant_id,
    )
    res = await db.execute(query)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    await menu_connection_manager.publish_event(
        restaurant_id=current_user.restaurant_id,
        event_data={
            "event": "MENU_ITEM_UPDATED",
            "item_id": str(item.id),
            "name": item.name,
            "price": float(item.price),
            "is_available": item.is_available,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return MenuItemResponse.model_validate(item)


@router.delete(
    "/menu/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Menu Administration"],
    summary="Delete a menu dish",
)
async def delete_item(
    item_id: UUID,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a dish from the manager's tenant restaurant and broadcasts event."""
    query = select(MenuItem).where(
        MenuItem.id == item_id,
        MenuItem.restaurant_id == current_user.restaurant_id,
    )
    res = await db.execute(query)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    await db.delete(item)
    await db.commit()

    await menu_connection_manager.publish_event(
        restaurant_id=current_user.restaurant_id,
        event_data={
            "event": "MENU_ITEM_DELETED",
            "item_id": str(item_id),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return None


@router.post(
    "/menu/seed-starter-dishes",
    status_code=status.HTTP_201_CREATED,
    tags=["Menu Administration"],
    summary="Seed authentic starter dishes across existing categories for this restaurant",
)
async def seed_starter_dishes(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Populates 8 sample dishes across the restaurant's categories."""
    rest_id = current_user.restaurant_id
    cat_stmt = select(MenuCategory).where(MenuCategory.restaurant_id == rest_id).order_by(MenuCategory.sort_order)
    cat_res = await db.execute(cat_stmt)
    categories = cat_res.scalars().all()

    if not categories:
        cat_defs = [
            ("Starters & Appetizers", 1),
            ("Main Course", 2),
            ("Beverages & Drinks", 3),
            ("Desserts", 4),
        ]
        categories = []
        for c_name, s_order in cat_defs:
            new_cat = MenuCategory(restaurant_id=rest_id, name=c_name, sort_order=s_order)
            db.add(new_cat)
            categories.append(new_cat)
        await db.flush()

    cat_map = {c.name.lower(): c.id for c in categories}
    starters_id = cat_map.get("starters & appetizers") or categories[0].id
    main_id = cat_map.get("main course") or (categories[1].id if len(categories) > 1 else categories[0].id)
    drinks_id = cat_map.get("beverages & drinks") or (categories[2].id if len(categories) > 2 else categories[0].id)
    desserts_id = cat_map.get("desserts") or (categories[3].id if len(categories) > 3 else categories[0].id)

    starter_dishes = [
        {
            "category_id": starters_id,
            "name": "Crispy Mozzarella Sticks",
            "name_ur": "کرسپی موزریلا سٹکس",
            "description": "Golden crumbed mozzarella cheese with spicy marinara dipping sauce.",
            "description_ur": "موزریلا پنیر اور مسالہ دار ساس۔",
            "price": 650.00,
            "kitchen_station": "fryer",
            "expected_prep_minutes": 10,
            "dietary_tags": ["vegetarian", "halal"],
            "image_url": "https://images.unsplash.com/photo-1548340748-6d2b7d7da280?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": starters_id,
            "name": "Dynamite Buffalo Wings",
            "name_ur": "ڈائنامائٹ بفیلو ونگز",
            "description": "Crispy fried chicken wings tossed in tangy buffalo glaze with ranch.",
            "description_ur": "کرسپی چکن ونگز اور بفیلو ساس۔",
            "price": 850.00,
            "kitchen_station": "fryer",
            "expected_prep_minutes": 12,
            "dietary_tags": ["halal"],
            "image_url": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": main_id,
            "name": "Royal Chicken Karahi",
            "name_ur": "شاہی چکن کڑاہی",
            "description": "Tender chicken cooked with fresh tomatoes, ginger, and roasted spices in a traditional wok.",
            "description_ur": "روایتی کڑاہی میں تیار شدہ تازہ چکن اور مسالے۔",
            "price": 1650.00,
            "kitchen_station": "hot_kitchen",
            "expected_prep_minutes": 20,
            "dietary_tags": ["halal", "spicy"],
            "image_url": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": main_id,
            "name": "Gourmet Angus Beef Burger",
            "name_ur": "گورمے بیف برگر",
            "description": "Juicy grilled beef patty with aged cheddar, caramelized onions, and secret sauce on brioche.",
            "description_ur": "گرلڈ بیف پیٹی اور چیڈر پنیر برگر۔",
            "price": 1250.00,
            "kitchen_station": "grill",
            "expected_prep_minutes": 15,
            "dietary_tags": ["halal"],
            "image_url": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": drinks_id,
            "name": "Fresh Mint Lemonade",
            "name_ur": "تازہ پودینہ لیمونیڈ",
            "description": "Crushed mint leaves, fresh lime juice, black salt, and sparkling soda.",
            "description_ur": "پودینہ، لیموں کا رس اور سوڈا۔",
            "price": 350.00,
            "kitchen_station": "drinks",
            "expected_prep_minutes": 5,
            "dietary_tags": ["vegetarian", "halal"],
            "image_url": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": drinks_id,
            "name": "Traditional Karak Chai",
            "name_ur": "روایتی کڑک چائے",
            "description": "Slowly brewed black tea leaves with evaporated milk and crushed cardamom.",
            "description_ur": "دودھ پتی کڑک چائے الائچی کے ساتھ۔",
            "price": 180.00,
            "kitchen_station": "drinks",
            "expected_prep_minutes": 6,
            "dietary_tags": ["halal"],
            "image_url": "https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": desserts_id,
            "name": "Warm Chocolate Lava Cake",
            "name_ur": "گرم چاکلیٹ لاوا کیک",
            "description": "Decadent dark chocolate molten cake with a scoop of artisanal vanilla ice cream.",
            "description_ur": "گرم چاکلیٹ کیک اور ونیلا آئس کریم۔",
            "price": 750.00,
            "kitchen_station": "dessert",
            "expected_prep_minutes": 10,
            "dietary_tags": ["vegetarian", "halal"],
            "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80",
        },
        {
            "category_id": desserts_id,
            "name": "Authentic Warm Gulab Jamun",
            "name_ur": "خالص گرم گلاب جامن",
            "description": "Tender milk-solid dumplings soaked in rose and cardamom saffron syrup.",
            "description_ur": "زعفرانی شیرے میں ڈوبے ہوئے گلاب جامن۔",
            "price": 450.00,
            "kitchen_station": "dessert",
            "expected_prep_minutes": 5,
            "dietary_tags": ["vegetarian", "halal"],
            "image_url": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80",
        },
    ]

    for d_item in starter_dishes:
        db.add(MenuItem(restaurant_id=rest_id, **d_item))

    await db.commit()
    return {"status": "success", "seeded_count": len(starter_dishes)}


# =============================================================================
# MODIFIER GROUPS & OPTIONS ADMINISTRATION (Manager Only)
# =============================================================================

@router.post(
    "/menu/items/{item_id}/modifier-groups",
    response_model=ModifierGroupResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Menu Modifiers"],
    summary="Attach a customization modifier group to a dish (e.g., Spice Level, Size)",
)
async def add_modifier_group(
    item_id: UUID,
    data: ModifierGroupCreate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Creates a modifier group for a dish with server-enforced min/max bounds."""
    # Verify item exists and belongs to restaurant
    item_res = await db.execute(
        select(MenuItem).where(
            MenuItem.id == item_id,
            MenuItem.restaurant_id == current_user.restaurant_id,
        )
    )
    if not item_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found.")

    group = ItemModifierGroup(
        restaurant_id=current_user.restaurant_id,
        item_id=item_id,
        name=data.name,
        name_ur=data.name_ur,
        selection_type=data.selection_type,
        min_selections=data.min_selections,
        max_selections=data.max_selections,
        is_required=data.is_required,
        sort_order=data.sort_order,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    return ModifierGroupResponse(
        id=group.id,
        restaurant_id=group.restaurant_id,
        item_id=group.item_id,
        name=group.name,
        name_ur=group.name_ur,
        selection_type=group.selection_type,
        min_selections=group.min_selections,
        max_selections=group.max_selections,
        is_required=group.is_required,
        sort_order=group.sort_order,
        options=[],
        created_at=group.created_at,
    )


@router.post(
    "/menu/modifier-groups/{group_id}/options",
    response_model=ModifierOptionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Menu Modifiers"],
    summary="Add a modifier choice with price delta (e.g., Extra Cheese +150 PKR)",
)
async def add_modifier_option(
    group_id: UUID,
    data: ModifierOptionCreate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Adds a modifier choice with price delta."""
    grp_res = await db.execute(
        select(ItemModifierGroup).where(
            ItemModifierGroup.id == group_id,
            ItemModifierGroup.restaurant_id == current_user.restaurant_id,
        )
    )
    if not grp_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modifier group not found.")

    option = ModifierOption(
        group_id=group_id,
        name=data.name,
        name_ur=data.name_ur,
        price_delta=data.price_delta,
        is_default=data.is_default,
        is_available=data.is_available,
        sort_order=data.sort_order,
    )
    db.add(option)
    await db.commit()
    await db.refresh(option)

    return ModifierOptionResponse.model_validate(option)


@router.patch(
    "/menu/modifier-options/{option_id}",
    response_model=ModifierOptionResponse,
    tags=["Menu Modifiers"],
    summary="Update modifier option name, price delta, or availability",
)
async def update_modifier_option(
    option_id: UUID,
    data: ModifierOptionUpdate,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """Updates modifier option name, price delta, or availability."""
    query = (
        select(ModifierOption)
        .join(ItemModifierGroup, ModifierOption.group_id == ItemModifierGroup.id)
        .where(
            ModifierOption.id == option_id,
            ItemModifierGroup.restaurant_id == current_user.restaurant_id,
        )
    )
    res = await db.execute(query)
    option = res.scalar_one_or_none()
    if not option:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Modifier option not found.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(option, field, value)

    await db.commit()
    await db.refresh(option)

    return ModifierOptionResponse.model_validate(option)
