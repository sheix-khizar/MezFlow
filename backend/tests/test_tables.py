import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.table import Table, TableStatus
from tests.conftest import DEMO_RESTAURANT_A_ID, DEMO_RESTAURANT_B_ID, TestSessionLocal


@pytest.fixture
async def manager_a_token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "manager@mezflow.com", "password": "manager123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.fixture
async def manager_b_token(client: AsyncClient) -> str:
    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "manager-b@mezflow.com", "password": "manager123"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_get_tables_and_qr_graphic(client: AsyncClient, manager_a_token: str):
    """TEST-M2-02: Validates table listing and physical QR graphic generation with dynamic base_url."""
    # 1. Fetch tables
    res = await client.get(
        "/api/v1/tables",
        headers={"Authorization": f"Bearer {manager_a_token}"},
    )
    assert res.status_code == 200
    tables = res.json()
    assert len(tables) > 0

    first_table = tables[0]
    table_id = first_table["id"]

    # 2. Fetch QR graphic for the table (with LAN IP)
    qr_res = await client.get(
        f"/api/v1/tables/{table_id}/qr",
        headers={
            "Authorization": f"Bearer {manager_a_token}",
            "Origin": "http://192.168.18.95:3001",
        },
    )
    assert qr_res.status_code == 200
    qr_data = qr_res.json()
    assert qr_data["table_id"] == table_id
    assert "diner_url" in qr_data
    assert qr_data["diner_url"].startswith("http://192.168.18.95:3001")
    assert "<svg" in qr_data["svg_data"]
    assert qr_data["png_data_url"].startswith("data:image/png;base64,")

    # 3. Fetch QR graphic with localhost origin (should automatically map to LAN IP so phones can scan)
    qr_local_res = await client.get(
        f"/api/v1/tables/{table_id}/qr",
        headers={
            "Authorization": f"Bearer {manager_a_token}",
            "Origin": "http://localhost:3001",
        },
    )
    assert qr_local_res.status_code == 200
    local_data = qr_local_res.json()
    assert not local_data["diner_url"].startswith("http://localhost")
    assert ":3001/r/" in local_data["diner_url"]


@pytest.mark.asyncio
async def test_table_qr_isolation(client: AsyncClient, manager_a_token: str, manager_b_token: str):
    """TEST-M2-03: Validates cross-tenant isolation for table QR graphic access."""
    # Restaurant A table should return 404 to Restaurant B manager
    res = await client.get(
        "/api/v1/tables",
        headers={"Authorization": f"Bearer {manager_a_token}"},
    )
    table_a_id = res.json()[0]["id"]

    qr_res = await client.get(
        f"/api/v1/tables/{table_a_id}/qr",
        headers={"Authorization": f"Bearer {manager_b_token}"},
    )
    assert qr_res.status_code == 404
