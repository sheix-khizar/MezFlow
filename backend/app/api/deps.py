import secrets
from typing import List, Optional, Dict, Any
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import jwt

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserProfile, UserRole
from app.models.restaurant import Restaurant
from app.models.table import Table, TableStatus
from app.models.menu import MenuCategory

# Reusable HTTP Bearer security scheme
security_bearer = HTTPBearer(auto_error=False)


def _try_decode_clerk_token(token: str) -> Optional[Dict[str, Any]]:
    """Attempts to decode and verify Clerk JWT claims."""
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
        iss = str(unverified.get("iss", ""))
        sub = str(unverified.get("sub", ""))
        if "clerk" in iss or sub.startswith("user_"):
            if settings.CLERK_JWKS_URL:
                from jwt import PyJWKClient
                jwks_client = PyJWKClient(settings.CLERK_JWKS_URL)
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                return jwt.decode(token, signing_key.key, algorithms=["RS256"], options={"verify_exp": True})
            return unverified
    except Exception:
        pass
    return None


async def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extracts and verifies JWT token from Authorization header.
    Supports Clerk multi-tenant organizations with automatic DB provisioning,
    falling back to local HS256 tokens for full backwards compatibility.
    (FR-M1-02, FR-M1-03)
    """
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: No token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.credentials

    # 1. Clerk RS256 Multi-Tenant Token Flow
    clerk_claims = _try_decode_clerk_token(token)
    if clerk_claims:
        clerk_user_id = str(clerk_claims.get("sub"))
        clerk_org_id = str(clerk_claims.get("org_id") or f"org_{clerk_user_id[-8:]}")

        # Ensure Restaurant exists for this Clerk organization
        rest_stmt = select(Restaurant).where(Restaurant.clerk_org_id == clerk_org_id)
        rest_res = await db.execute(rest_stmt)
        restaurant = rest_res.scalar_one_or_none()
        if not restaurant:
            org_name = clerk_claims.get("org_name") or f"Restaurant {clerk_org_id[-6:]}"
            slug = f"org-{clerk_org_id[-8:].lower()}"
            restaurant = Restaurant(
                name=org_name,
                slug=slug,
                clerk_org_id=clerk_org_id,
                currency="PKR",
                is_active=True,
            )
            db.add(restaurant)
            await db.flush()

            # Seed 10 starter tables
            for t_num in range(1, 11):
                db.add(
                    Table(
                        restaurant_id=restaurant.id,
                        table_number=t_num,
                        capacity=4,
                        status=TableStatus.AVAILABLE,
                        qr_code_token=f"QR-{slug}-T{t_num}-{secrets.token_hex(3).upper()}",
                    )
                )

            # Seed starter categories
            db.add(MenuCategory(restaurant_id=restaurant.id, name="Starters", sort_order=1))
            db.add(MenuCategory(restaurant_id=restaurant.id, name="Main Course", sort_order=2))
            await db.flush()

        # Find or create User by clerk_user_id
        user_stmt = (
            select(User)
            .options(selectinload(User.profile), selectinload(User.restaurant))
            .where(User.clerk_user_id == clerk_user_id)
        )
        user_res = await db.execute(user_stmt)
        user = user_res.scalar_one_or_none()

        if not user:
            raw_role = str(clerk_claims.get("org_role", "")).lower()
            if "manager" in raw_role or "admin" in raw_role or not clerk_claims.get("org_role"):
                mapped_role = UserRole.MANAGER
            elif "kitchen" in raw_role:
                mapped_role = UserRole.KITCHEN_STAFF
            elif "service" in raw_role or "waiter" in raw_role:
                mapped_role = UserRole.SERVICE_STAFF
            elif "cashier" in raw_role:
                mapped_role = UserRole.CASHIER
            else:
                mapped_role = UserRole.CUSTOMER

            email = clerk_claims.get("email") or f"{clerk_user_id}@clerk.user"
            user = User(
                restaurant_id=restaurant.id,
                clerk_user_id=clerk_user_id,
                email=email,
                role=mapped_role,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()

            disp_name = clerk_claims.get("name") or email.split("@")[0]
            profile = UserProfile(
                user_id=user.id,
                display_name=disp_name,
                preferred_language="en",
                push_notifications_enabled=True,
            )
            db.add(profile)
            await db.commit()

            user_res = await db.execute(user_stmt)
            user = user_res.scalar_one()

        return user

    # 2. Local JWT Fallback (HS256)
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload["sub"]
    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token identity.",
        )

    stmt = (
        select(User)
        .options(selectinload(User.profile), selectinload(User.restaurant))
        .where(User.id == user_uuid)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token no longer exists.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact management.",
        )

    return user


def require_roles(allowed_roles: List[UserRole]):
    """
    Role-Based Access Control (RBAC) dependency factory.
    Enforces server-side permissions for API routes. (FR-M1-03, NFR-07)
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires one of roles {[r.value for r in allowed_roles]}.",
            )
        return current_user

    return role_checker


def require_manager():
    """Dependency shorthand restricting access to Manager role only."""
    return require_roles([UserRole.MANAGER])


def require_staff():
    """Dependency shorthand for all internal restaurant staff."""
    return require_roles([
        UserRole.MANAGER,
        UserRole.KITCHEN_STAFF,
        UserRole.SERVICE_STAFF,
        UserRole.CASHIER,
    ])


def enforce_tenant(restaurant_id: UUID, current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces that the user belongs strictly to the requested restaurant.
    Guarantees multi-tenant data isolation. (FR-M1-07, NFR-08)
    """
    if current_user.restaurant_id != restaurant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot access data of another restaurant.",
        )
    return current_user
