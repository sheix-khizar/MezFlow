import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.table import Table, TableStatus
from app.models.order import Order, OrderStatus, OrderItem
from tests.conftest import DEMO_RESTAURANT_A_ID, TestSessionLocal


@pytest.fixture
async def kitchen_staff_token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "kitchen@mezflow.com", "password": "kitchen123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
async def customer_token(client: AsyncClient) -> str:
    # Customer registration
    unique_phone = f"+923{uuid.uuid4().int % 900000000 + 100000000}"
    res = await client.post(
        "/api/v1/auth/signup",
        json={
            "restaurant_id": str(DEMO_RESTAURANT_A_ID),
            "phone_number": unique_phone,
            "display_name": "Test Customer",
            "password": "Password123!",
        },
    )
    assert res.status_code == 201
    # Customer login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username": unique_phone, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


@pytest.fixture
async def seeded_test_order() -> Order:
    """Creates a seeded order in DB with Grill and Beverage items."""
    async with TestSessionLocal() as session:
        from sqlalchemy import func
        max_res = await session.execute(
            select(func.coalesce(func.max(Table.table_number), 1000)).where(
                Table.restaurant_id == DEMO_RESTAURANT_A_ID
            )
        )
        table_num = int(max_res.scalar() or 1000) + 1
        table = Table(
            restaurant_id=DEMO_RESTAURANT_A_ID,
            table_number=table_num,
            name=f"Table {table_num}",
            qr_code_token=f"kds_t_{uuid.uuid4().hex[:10]}",
            capacity=4,
            status=TableStatus.OCCUPIED,
        )
        session.add(table)
        await session.flush()

        order_num = int(uuid.uuid4().int % 9000 + 100)
        order = Order(
            restaurant_id=DEMO_RESTAURANT_A_ID,
            table_id=table.id,
            order_number=order_num,
            display_number=f"ORD-{order_num}",
            status=OrderStatus.NEW,
            subtotal=Decimal("2500.00"),
            tax_amount=Decimal("400.00"),
            total_amount=Decimal("2900.00"),
            notes="Fast prep please",
            target_prep_minutes=15,
        )
        session.add(order)
        await session.flush()

        # Item 1: Grill
        item_grill = OrderItem(
            order_id=order.id,
            item_name="Seekh Kebab Platter",
            kitchen_station="grill",
            quantity=2,
            unit_price=Decimal("1000.00"),
            total_price=Decimal("2000.00"),
            special_instructions="Spicy",
            status="PENDING",
        )
        # Item 2: Beverage
        item_bev = OrderItem(
            order_id=order.id,
            item_name="Fresh Lime Mint",
            kitchen_station="beverage",
            quantity=1,
            unit_price=Decimal("500.00"),
            total_price=Decimal("500.00"),
            status="PENDING",
        )
        session.add_all([item_grill, item_bev])
        await session.commit()
        await session.refresh(order)
        return order


@pytest.mark.asyncio
async def test_kds_active_queue_load(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-01: Authenticated kitchen staff loads active order queue."""
    res = await client.get(
        "/api/v1/kds/orders/active",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res.status_code == 200
    orders = res.json()
    assert len(orders) >= 1

    # Find seeded order
    card = next((o for o in orders if o["id"] == str(seeded_test_order.id)), None)
    assert card is not None
    assert card["display_number"] == seeded_test_order.display_number
    assert card["status"] == "NEW"
    assert len(card["items"]) == 2
    assert "urgency_level" in card
    assert "elapsed_seconds" in card


@pytest.mark.asyncio
async def test_kds_summary_metrics(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-02: Returns aggregated metric counters for tickets and station breakdown."""
    res = await client.get(
        "/api/v1/kds/summary",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_active" in data
    assert data["total_active"] >= 1
    assert "by_station" in data
    assert "grill" in data["by_station"]
    assert "beverage" in data["by_station"]


@pytest.mark.asyncio
async def test_kds_bump_to_preparing_and_ready(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-03 & TEST-M4-04: Single-tap bump transitions order through state machine."""
    order_id = str(seeded_test_order.id)

    # 1. First bump: NEW -> PREPARING
    res1 = await client.patch(
        f"/api/v1/kds/orders/{order_id}/bump",
        json={},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "PREPARING"

    # 2. Second bump: PREPARING -> READY
    res2 = await client.patch(
        f"/api/v1/kds/orders/{order_id}/bump",
        json={},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "READY"

    # 3. Third bump: READY -> DISPATCHED
    res3 = await client.patch(
        f"/api/v1/kds/orders/{order_id}/bump",
        json={},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["status"] == "DISPATCHED"

    # 4. Verify order is now excluded from active queue
    res_active = await client.get(
        "/api/v1/kds/orders/active",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res_active.status_code == 200
    active_ids = [o["id"] for o in res_active.json()]
    assert order_id not in active_ids


@pytest.mark.asyncio
async def test_kds_invalid_state_transition(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-05: Rejection of illegal state transitions (e.g. NEW -> DISPATCHED)."""
    order_id = str(seeded_test_order.id)

    # Attempt to skip directly to DISPATCHED
    res = await client.patch(
        f"/api/v1/kds/orders/{order_id}/bump",
        json={"target_status": "DISPATCHED"},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res.status_code == 400
    assert "Invalid state transition" in res.json()["detail"]


@pytest.mark.asyncio
async def test_kds_recall_action(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-06: 60-second recall reverts an accidental bump."""
    order_id = str(seeded_test_order.id)

    # Bump to PREPARING
    bump_res = await client.patch(
        f"/api/v1/kds/orders/{order_id}/bump",
        json={},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert bump_res.status_code == 200
    assert bump_res.json()["status"] == "PREPARING"

    # Immediately recall back
    recall_res = await client.post(
        f"/api/v1/kds/orders/{order_id}/recall",
        json={"reason": "Chef tapped by accident"},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert recall_res.status_code == 200
    assert recall_res.json()["status"] == "NEW"


@pytest.mark.asyncio
async def test_kds_station_filtering(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-07: Station filter isolates orders and items by kitchen station."""
    # 1. Query with station=grill
    res_grill = await client.get(
        "/api/v1/kds/orders/active?station=grill",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res_grill.status_code == 200
    grill_card = next(
        (o for o in res_grill.json() if o["id"] == str(seeded_test_order.id)),
        None,
    )
    assert grill_card is not None
    # Should only contain the grill item, not beverage
    assert len(grill_card["items"]) == 1
    assert grill_card["items"][0]["kitchen_station"] == "grill"

    # 2. Query with station=fry (seeded order has no fry items)
    res_fry = await client.get(
        "/api/v1/kds/orders/active?station=fry",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res_fry.status_code == 200
    fry_card = next(
        (o for o in res_fry.json() if o["id"] == str(seeded_test_order.id)),
        None,
    )
    assert fry_card is None


@pytest.mark.asyncio
async def test_kds_role_protection_customer_forbidden(
    client: AsyncClient, customer_token: str, seeded_test_order: Order
):
    """TEST-M4-08: Customers cannot access KDS endpoints (RBAC NFR-07)."""
    res = await client.get(
        "/api/v1/kds/orders/active",
        headers={"Authorization": f"Bearer {customer_token}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_kds_item_status_checkoff(
    client: AsyncClient, kitchen_staff_token: str, seeded_test_order: Order
):
    """TEST-M4-09: Line cook marks dish READY without closing whole order."""
    order_id = str(seeded_test_order.id)

    # First get item IDs
    res_active = await client.get(
        "/api/v1/kds/orders/active",
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    card = next(o for o in res_active.json() if o["id"] == order_id)
    first_item_id = card["items"][0]["id"]

    # Mark first item READY
    res_item = await client.patch(
        f"/api/v1/kds/orders/{order_id}/items/{first_item_id}/status",
        json={"status": "READY"},
        headers={"Authorization": f"Bearer {kitchen_staff_token}"},
    )
    assert res_item.status_code == 200
    assert res_item.json()["status"] == "READY"
