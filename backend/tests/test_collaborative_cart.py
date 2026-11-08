import uuid
from decimal import Decimal
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.table import Table, TableStatus
from app.models.menu import MenuItem, ModifierOption, ItemModifierGroup
from app.models.session import TableSession, SessionStatus, Diner
from app.models.order import Order, OrderStatus
from tests.conftest import DEMO_RESTAURANT_A_ID, TestSessionLocal


@pytest.fixture
async def staff_token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "manager@mezflow.com", "password": "manager123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
async def table_with_token() -> str:
    token = f"t_test_{uuid.uuid4().hex[:12]}"
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
            name=f"Test Table {table_num}",
            qr_code_token=token,
            capacity=4,
            status=TableStatus.AVAILABLE,
        )
        session.add(table)
        await session.commit()
    return token


@pytest.mark.asyncio
async def test_session_initiation_and_table_occupancy(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-01: First diner scanning table QR initiates session and sets table to OCCUPIED."""
    payload = {
        "qr_code_token": table_with_token,
        "display_name": "Sail",
        "avatar_color": "#10B981",
    }
    res = await client.post("/api/v1/sessions/join", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert data["status"] == "ACTIVE"
    assert data["current_diner"]["display_name"] == "Sail"
    assert data["current_diner"]["is_host"] is True

    session_id = data["id"]

    # Verify table status in DB transitioned to OCCUPIED
    async with TestSessionLocal() as session:
        tbl_res = await session.execute(
            select(Table).where(Table.id == uuid.UUID(data["table_id"]))
        )
        tbl = tbl_res.scalar_one()
        assert tbl.status == TableStatus.OCCUPIED


@pytest.mark.asyncio
async def test_multi_diner_joining_same_session(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-02: Second diner scanning same table joins identical session automatically."""
    # Diner 1 (Host)
    res1 = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "Sail"},
    )
    assert res1.status_code == 200
    session_id = res1.json()["id"]

    # Diner 2 (Friend)
    res2 = await client.post(
        "/api/v1/sessions/join",
        json={
            "qr_code_token": table_with_token,
            "display_name": "Khizar",
            "avatar_color": "#F59E0B",
        },
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["id"] == session_id  # Same session!
    assert data2["current_diner"]["display_name"] == "Khizar"
    assert data2["current_diner"]["is_host"] is False

    # Check cart diner list has both diners
    cart_res = await client.get(f"/api/v1/sessions/{session_id}/cart")
    assert cart_res.status_code == 200
    diner_names = [d["display_name"] for d in cart_res.json()["diners"]]
    assert "Sail" in diner_names
    assert "Khizar" in diner_names


@pytest.mark.asyncio
async def test_shared_cart_add_item_with_modifiers_and_attribution(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-03: Diner adds item with modifiers; item correctly records diner attribution and price."""
    # 1. Join session as Khizar
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "Khizar"},
    )
    session_data = join_res.json()
    session_id = session_data["id"]
    diner_id = session_data["current_diner"]["id"]

    # 2. Pick a dish with modifiers from public menu
    menu_res = await client.get(f"/api/v1/restaurants/{DEMO_RESTAURANT_A_ID}/menu")
    categories = menu_res.json()["categories"]
    target_dish = None
    target_option_id = None

    for cat in categories:
        for item in cat["items"]:
            if item.get("modifier_groups") and len(item["modifier_groups"]) > 0:
                target_dish = item
                # Pick valid option from first group
                grp = item["modifier_groups"][0]
                if grp["options"]:
                    target_option_id = grp["options"][0]["id"]
                break
        if target_dish:
            break

    assert target_dish is not None

    # 3. Add to shared cart
    add_payload = {
        "item_id": target_dish["id"],
        "quantity": 2,
        "selected_modifier_option_ids": [target_option_id] if target_option_id else [],
        "special_instructions": "Make it extra crisp please",
    }
    headers = {"X-Diner-ID": diner_id}
    cart_res = await client.post(
        f"/api/v1/sessions/{session_id}/cart/items",
        json=add_payload,
        headers=headers,
    )
    assert cart_res.status_code == 201
    cart = cart_res.json()
    assert cart["item_count"] >= 2
    assert len(cart["items"]) > 0

    # Verify per-diner attribution
    added_item = [i for i in cart["items"] if i["item_id"] == target_dish["id"]][0]
    assert added_item["diner_id"] == diner_id
    assert added_item["diner_name"] == "Khizar"
    assert added_item["quantity"] == 2
    assert added_item["special_instructions"] == "Make it extra crisp please"


@pytest.mark.asyncio
async def test_modifier_rule_enforcement_in_cart(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-04: Rejects adding dish without satisfying required modifier group."""
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "TestDiner"},
    )
    session_id = join_res.json()["id"]
    diner_id = join_res.json()["current_diner"]["id"]

    # Find item with required modifier group
    menu_res = await client.get(f"/api/v1/restaurants/{DEMO_RESTAURANT_A_ID}/menu")
    req_item = None
    for cat in menu_res.json()["categories"]:
        for itm in cat["items"]:
            for grp in itm.get("modifier_groups", []):
                if grp.get("is_required"):
                    req_item = itm
                    break
            if req_item:
                break
        if req_item:
            break

    if req_item:
        # Attempt to add with NO modifiers selected
        headers = {"X-Diner-ID": diner_id}
        bad_add = await client.post(
            f"/api/v1/sessions/{session_id}/cart/items",
            json={
                "item_id": req_item["id"],
                "quantity": 1,
                "selected_modifier_option_ids": [],  # Missing required choice!
            },
            headers=headers,
        )
        assert bad_add.status_code == 422


@pytest.mark.asyncio
async def test_update_and_remove_cart_item(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-05: Modifying quantity, updating instructions, and removing items from shared cart."""
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "Sail"},
    )
    session_id = join_res.json()["id"]
    diner_id = join_res.json()["current_diner"]["id"]
    headers = {"X-Diner-ID": diner_id}

    # Add a simple item
    menu_res = await client.get(f"/api/v1/restaurants/{DEMO_RESTAURANT_A_ID}/menu")
    dish = menu_res.json()["categories"][0]["items"][0]

    # Pre-select any required options
    selected_mods = []
    for grp in dish.get("modifier_groups", []):
        if grp.get("is_required") and grp.get("options"):
            selected_mods.append(grp["options"][0]["id"])

    add_res = await client.post(
        f"/api/v1/sessions/{session_id}/cart/items",
        json={
            "item_id": dish["id"],
            "quantity": 1,
            "selected_modifier_option_ids": selected_mods,
        },
        headers=headers,
    )
    assert add_res.status_code == 201
    item_id = add_res.json()["items"][-1]["id"]

    # 1. Update quantity to 4
    patch_res = await client.patch(
        f"/api/v1/sessions/{session_id}/cart/items/{item_id}",
        json={"quantity": 4, "special_instructions": "Mild spicy please"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated_item = [i for i in patch_res.json()["items"] if i["id"] == item_id][0]
    assert updated_item["quantity"] == 4
    assert updated_item["special_instructions"] == "Mild spicy please"

    # 2. Delete item from cart
    del_res = await client.delete(
        f"/api/v1/sessions/{session_id}/cart/items/{item_id}",
        headers=headers,
    )
    assert del_res.status_code == 200
    remaining_ids = [i["id"] for i in del_res.json()["items"]]
    assert item_id not in remaining_ids


@pytest.mark.asyncio
async def test_order_submission_and_status_tracking(
    client: AsyncClient, table_with_token: str, staff_token: str
):
    """TEST-M3-06 & TEST-M3-07: Submitting cart locks session, generates daily order number, and tracks status."""
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "HostDiner"},
    )
    session_id = join_res.json()["id"]
    diner_id = join_res.json()["current_diner"]["id"]
    headers = {"X-Diner-ID": diner_id}

    # Add an item to ensure non-empty cart
    menu_res = await client.get(f"/api/v1/restaurants/{DEMO_RESTAURANT_A_ID}/menu")
    dish = menu_res.json()["categories"][0]["items"][0]
    selected_mods = []
    for grp in dish.get("modifier_groups", []):
        if grp.get("is_required") and grp.get("options"):
            selected_mods.append(grp["options"][0]["id"])

    await client.post(
        f"/api/v1/sessions/{session_id}/cart/items",
        json={"item_id": dish["id"], "quantity": 2, "selected_modifier_option_ids": selected_mods},
        headers=headers,
    )

    # 1. Submit Order
    submit_res = await client.post(
        f"/api/v1/sessions/{session_id}/submit",
        json={"notes": "Table requesting order together"},
        headers=headers,
    )
    assert submit_res.status_code == 201
    order = submit_res.json()
    assert "id" in order
    assert order["status"] == "NEW"
    assert order["order_number"] >= 1
    assert order["display_number"].startswith("ORD-")
    assert order["placed_by_diner_name"] == "HostDiner"
    assert len(order["items"]) > 0

    order_id = order["id"]

    # 2. Verify Session Orders list
    orders_res = await client.get(f"/api/v1/sessions/{session_id}/orders")
    assert orders_res.status_code == 200
    assert any(o["id"] == order_id for o in orders_res.json())

    # 3. Staff advances status: NEW -> PREPARING
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    status_res = await client.patch(
        f"/api/v1/orders/{order_id}/status",
        json={"status": "PREPARING"},
        headers=staff_headers,
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "PREPARING"


@pytest.mark.asyncio
async def test_empty_cart_submission_rejection(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-08: Submitting an empty cart is cleanly rejected with 400 Bad Request."""
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "SoloDiner"},
    )
    session_id = join_res.json()["id"]
    diner_id = join_res.json()["current_diner"]["id"]
    headers = {"X-Diner-ID": diner_id}

    # Ensure cart is cleared
    await client.delete(f"/api/v1/sessions/{session_id}/cart", headers=headers)

    # Attempt submit
    res = await client.post(
        f"/api/v1/sessions/{session_id}/submit",
        json={},
        headers=headers,
    )
    assert res.status_code == 400
    assert "empty cart" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_concurrent_cart_mutations_and_race_prevention(
    client: AsyncClient, table_with_token: str
):
    """TEST-M3-09: Concurrent item additions and double-submission mutex lock (NFR-03, NFR-04)."""
    import asyncio

    # 1. Join session
    join_res = await client.post(
        "/api/v1/sessions/join",
        json={"qr_code_token": table_with_token, "display_name": "Host"},
    )
    session_id = join_res.json()["id"]
    host_id = join_res.json()["current_diner"]["id"]

    # 2. Join 3 more simulated diners
    diner_ids = [host_id]
    for name in ["DinerA", "DinerB", "DinerC"]:
        res = await client.post(
            "/api/v1/sessions/join",
            json={"qr_code_token": table_with_token, "display_name": name},
        )
        diner_ids.append(res.json()["current_diner"]["id"])

    # 3. Pick a simple dish
    menu_res = await client.get(f"/api/v1/restaurants/{DEMO_RESTAURANT_A_ID}/menu")
    dish = menu_res.json()["categories"][0]["items"][0]
    selected_mods = []
    for grp in dish.get("modifier_groups", []):
        if grp.get("is_required") and grp.get("options"):
            selected_mods.append(grp["options"][0]["id"])

    # 4. Concurrently add items from all 4 diners
    async def add_item_for_diner(did: str):
        return await client.post(
            f"/api/v1/sessions/{session_id}/cart/items",
            json={"item_id": dish["id"], "quantity": 1, "selected_modifier_option_ids": selected_mods},
            headers={"X-Diner-ID": did},
        )

    results = await asyncio.gather(*(add_item_for_diner(did) for did in diner_ids))
    for r in results:
        assert r.status_code == 201

    # Authoritative cart has total quantity = 4
    cart_res = await client.get(f"/api/v1/sessions/{session_id}/cart")
    assert cart_res.json()["item_count"] == 4

    # 5. Double-submission test: Two diners hit submit concurrently
    sub1_coro = client.post(
        f"/api/v1/sessions/{session_id}/submit",
        json={"notes": "Submit 1"},
        headers={"X-Diner-ID": diner_ids[0]},
    )
    sub2_coro = client.post(
        f"/api/v1/sessions/{session_id}/submit",
        json={"notes": "Submit 2"},
        headers={"X-Diner-ID": diner_ids[1]},
    )
    sub1, sub2 = await asyncio.gather(sub1_coro, sub2_coro)
    status_codes = {sub1.status_code, sub2.status_code}

    # Exactly one must succeed (201 Created), and the other must be rejected (409 Conflict or 400 Bad Request)
    assert 201 in status_codes
    assert (409 in status_codes) or (400 in status_codes)
