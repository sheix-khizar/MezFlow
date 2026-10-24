from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, require_manager, enforce_tenant
from app.models.restaurant import Restaurant
from app.models.table import Table, TableStatus
from app.models.user import User
from app.schemas.table import (
    TableCreate,
    TableUpdate,
    TableResponse,
    TableLookupResponse,
    TableQRGraphicResponse,
)
from app.services.table_service import (
    generate_table_qr_token,
    lookup_table_by_token,
    build_table_qr_response,
)
from app.services.audit import record_audit_log

router = APIRouter()


def resolve_lan_ip() -> str:
    """
    Determines local network IP address so physical mobile devices
    scanning tabletop QR codes can reach the frontend server on the same Wi-Fi.
    """
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


# -----------------------------------------------------------------------------
# Public Diner Endpoint (Zero-Install Access)
# -----------------------------------------------------------------------------
@router.get(
    "/lookup/{qr_code_token}",
    response_model=TableLookupResponse,
    tags=["Tables & QR Access"],
    summary="Verify table QR token and retrieve dining session metadata (Public)",
)
async def lookup_table(
    qr_code_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Validates a physical tabletop QR code token and returns restaurant and table details.
    (FR-M2-01, NFR-15)
    """
    return await lookup_table_by_token(db, qr_code_token)


# -----------------------------------------------------------------------------
# Protected Manager Endpoints (Role: Manager)
# -----------------------------------------------------------------------------
@router.get(
    "",
    response_model=List[TableResponse],
    tags=["Tables & QR Access"],
    summary="List all tables for the manager's restaurant",
)
async def list_tables(
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all tables for the manager's tenant restaurant.
    (FR-M2-07, NFR-08)
    """
    stmt = (
        select(Table)
        .where(Table.restaurant_id == current_user.restaurant_id)
        .order_by(Table.table_number)
    )
    res = await db.execute(stmt)
    tables = res.scalars().all()
    # Normalize enum values for response model
    return [
        TableResponse(
            id=t.id,
            restaurant_id=t.restaurant_id,
            table_number=t.table_number,
            name=t.name,
            qr_code_token=t.qr_code_token,
            capacity=t.capacity,
            status=t.status.value if hasattr(t.status, "value") else str(t.status).lower(),
            created_at=t.created_at,
        )
        for t in tables
    ]


@router.post(
    "",
    response_model=TableResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Tables & QR Access"],
    summary="Create a new physical table with auto-generated cryptographic QR token",
)
async def create_table(
    data: TableCreate,
    request: Request,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new physical table for the manager's restaurant.
    Automatically provisions a cryptographically unguessable QR token.
    (FR-M2-01, FR-M2-07, NFR-08)
    """
    # Check if table number is already in use in this restaurant
    stmt = select(Table).where(
        Table.restaurant_id == current_user.restaurant_id,
        Table.table_number == data.table_number,
    )
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Table number {data.table_number} already exists in this restaurant.",
        )

    token = generate_table_qr_token(data.table_number)

    status_val = TableStatus.AVAILABLE
    if data.status:
        try:
            status_val = TableStatus(data.status.lower())
        except ValueError:
            status_val = TableStatus.AVAILABLE

    table = Table(
        restaurant_id=current_user.restaurant_id,
        table_number=data.table_number,
        name=data.name or f"Table {data.table_number}",
        qr_code_token=token,
        capacity=data.capacity,
        status=status_val,
    )
    db.add(table)
    await db.flush()

    # Record Audit Log
    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    await record_audit_log(
        db=db,
        restaurant_id=current_user.restaurant_id,
        user_id=current_user.id,
        action="TABLE_CREATED",
        resource_type="table",
        resource_id=str(table.id),
        details={"table_number": table.table_number, "token": token},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(table)

    return TableResponse(
        id=table.id,
        restaurant_id=table.restaurant_id,
        table_number=table.table_number,
        name=table.name,
        qr_code_token=table.qr_code_token,
        capacity=table.capacity,
        status=table.status.value if hasattr(table.status, "value") else str(table.status).lower(),
        created_at=table.created_at,
    )


@router.get(
    "/{table_id}/qr",
    response_model=TableQRGraphicResponse,
    tags=["Tables & QR Access"],
    summary="Get printable SVG and PNG QR graphics for physical acrylic stand",
)
async def get_table_qr_graphic(
    table_id: UUID,
    request: Request,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """
    Renders printable SVG and PNG data URLs for tabletop QR acrylic stand cards.
    (FR-M2-07)
    """
    stmt = (
        select(Table, Restaurant)
        .join(Restaurant, Table.restaurant_id == Restaurant.id)
        .where(
            Table.id == table_id,
            Table.restaurant_id == current_user.restaurant_id,
        )
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found.",
        )

    table, restaurant = row

    # Determine base frontend URL from request origin/referer or host.
    # When scanned from a physical mobile camera, 'localhost' points to the phone itself,
    # causing 'This site can't be reached'. Replace loopback hosts with the LAN IP.
    lan_ip = resolve_lan_ip()
    origin = request.headers.get("origin") or request.headers.get("referer")
    if origin:
        from urllib.parse import urlparse
        parsed = urlparse(origin)
        scheme = parsed.scheme or "http"
        hostname = parsed.hostname or "localhost"
        port_str = f":{parsed.port}" if parsed.port else ""
        if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            hostname = lan_ip
            if not port_str:
                port_str = ":3001"
        base_url = f"{scheme}://{hostname}{port_str}"
    else:
        req_host = request.headers.get("host", "").split(":")[0] or "localhost"
        if req_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            req_host = lan_ip
        base_url = f"http://{req_host}:3001"

    return build_table_qr_response(table, restaurant, base_url=base_url)


@router.post(
    "/{table_id}/regenerate-qr",
    response_model=TableResponse,
    tags=["Tables & QR Access"],
    summary="Regenerate cryptographic QR token (invalidating previous QR code)",
)
async def regenerate_table_qr(
    table_id: UUID,
    request: Request,
    current_user: User = Depends(require_manager()),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidates current tabletop QR code and assigns a new cryptographically secure token.
    (FR-M2-07)
    """
    stmt = select(Table).where(
        Table.id == table_id,
        Table.restaurant_id == current_user.restaurant_id,
    )
    res = await db.execute(stmt)
    table = res.scalar_one_or_none()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Table not found.",
        )

    old_token = table.qr_code_token
    new_token = generate_table_qr_token(table.table_number)
    table.qr_code_token = new_token

    forwarded = request.headers.get("X-Forwarded-For")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)
    await record_audit_log(
        db=db,
        restaurant_id=current_user.restaurant_id,
        user_id=current_user.id,
        action="TABLE_QR_REGENERATED",
        resource_type="table",
        resource_id=str(table.id),
        details={"table_number": table.table_number, "old_token": old_token, "new_token": new_token},
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(table)

    return TableResponse(
        id=table.id,
        restaurant_id=table.restaurant_id,
        table_number=table.table_number,
        name=table.name,
        qr_code_token=table.qr_code_token,
        capacity=table.capacity,
        status=table.status.value if hasattr(table.status, "value") else str(table.status).lower(),
        created_at=table.created_at,
    )
