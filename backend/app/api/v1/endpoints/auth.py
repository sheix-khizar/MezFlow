from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, require_roles, enforce_tenant
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import User, UserProfile, UserRole
from app.models.audit import AuditLog
from app.models.restaurant import Restaurant
import re
import secrets
from app.models.table import Table, TableStatus
from app.models.menu import MenuCategory, MenuItem
from app.schemas.auth import (
    UserSignupRequest,
    StaffCreateRequest,
    UserLoginPasswordRequest,
    OTPRequest,
    OTPVerifyLoginRequest,
    TokenResponse,
    UserProfileUpdate,
    UserProfileResponse,
    UserResponse,
    AuditLogResponse,
    RestaurantRegisterRequest,
    OnboardingRequest,
)
from app.services.otp import OTPService
from app.services.audit import record_audit_log

router = APIRouter()


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
async def signup(
    data: UserSignupRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Registers a new user (Customer or Staff) under a restaurant.
    (FR-M1-01, FR-M1-05)
    """
    # 1. Verify restaurant exists
    rest_res = await db.execute(select(Restaurant).where(Restaurant.id == data.restaurant_id))
    if not rest_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found.",
        )

    # 2. Check for existing user in this restaurant
    conditions = []
    if data.email:
        conditions.append(User.email == data.email)
    if data.phone_number:
        conditions.append(User.phone_number == data.phone_number)

    if not conditions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either email or phone number must be provided.",
        )

    stmt = select(User).where(User.restaurant_id == data.restaurant_id, or_(*conditions))
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email or phone number already exists for this restaurant.",
        )

    # 3. Hash password
    if not data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required for signup.",
        )
    hashed_pwd = get_password_hash(data.password)

    # 4. Create User & Profile (Always force Customer role for public signup)
    new_user = User(
        restaurant_id=data.restaurant_id,
        email=data.email,
        phone_number=data.phone_number,
        hashed_password=hashed_pwd,
        role=UserRole.CUSTOMER,
        is_active=True,
        is_verified=False,
    )
    db.add(new_user)
    await db.flush()

    profile = UserProfile(
        user_id=new_user.id,
        display_name=data.display_name,
        preferred_language=data.preferred_language,
        push_notifications_enabled=True,
    )
    db.add(profile)
    await db.flush()

    # 5. Record Audit Log
    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=data.restaurant_id,
        user_id=new_user.id,
        action="USER_SIGNUP",
        resource_type="user",
        resource_id=str(new_user.id),
        details={"role": new_user.role.value, "display_name": data.display_name},
        ip_address=ip,
    )
    await db.commit()

    # 6. Generate Token
    token = create_access_token(
        subject=str(new_user.id),
        claims={
            "role": new_user.role.value,
            "restaurant_id": str(data.restaurant_id),
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=new_user.role.value,
        restaurant_id=data.restaurant_id,
        user_id=new_user.id,
        display_name=profile.display_name,
        preferred_language=profile.preferred_language,
    )


@router.post("/staff", response_model=UserResponse, status_code=status.HTTP_201_CREATED, tags=["Administration"])
async def create_staff(
    data: StaffCreateRequest,
    request: Request,
    current_user: User = Depends(require_roles([UserRole.MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    """
    Provisions a staff user (Manager, Kitchen, Service, Cashier) within the manager's tenant restaurant.
    Guarded strictly by Manager RBAC and tenant enforcement.
    (FR-M1-03, FR-M1-05, FR-M1-07, NFR-08)
    """
    # Cross-tenant guard
    enforce_tenant(data.restaurant_id, current_user)

    if data.role == UserRole.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer accounts cannot be created via the staff provisioning endpoint.",
        )

    # Check for existing user in this restaurant
    stmt = select(User).where(
        User.restaurant_id == data.restaurant_id,
        or_(
            User.email == data.email,
            User.phone_number == data.phone_number if data.phone_number else False,
        ),
    )
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email or phone number already exists in this restaurant.",
        )

    hashed_pwd = get_password_hash(data.password)
    staff_user = User(
        restaurant_id=data.restaurant_id,
        email=data.email,
        phone_number=data.phone_number,
        hashed_password=hashed_pwd,
        role=data.role,
        is_active=True,
        is_verified=True,
    )
    db.add(staff_user)
    await db.flush()

    profile = UserProfile(
        user_id=staff_user.id,
        display_name=data.display_name,
        preferred_language=data.preferred_language,
        push_notifications_enabled=True,
    )
    db.add(profile)
    await db.flush()

    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=data.restaurant_id,
        user_id=current_user.id,
        action="STAFF_USER_CREATED",
        resource_type="user",
        resource_id=str(staff_user.id),
        details={"role": staff_user.role.value, "email": data.email, "display_name": data.display_name},
        ip_address=ip,
    )
    await db.commit()
    stmt = (
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == staff_user.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/staff", response_model=List[UserResponse], tags=["Administration"])
async def list_staff(
    current_user: User = Depends(require_roles([UserRole.MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns all real staff members for the authenticated manager's restaurant workspace.
    """
    stmt = (
        select(User)
        .options(selectinload(User.profile))
        .where(
            User.restaurant_id == current_user.restaurant_id,
            User.role.in_([UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.SERVICE_STAFF, UserRole.CASHIER]),
        )
        .order_by(User.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/staff/seed-starter-team", response_model=List[UserResponse], tags=["Administration"])
async def seed_starter_team(
    current_user: User = Depends(require_roles([UserRole.MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    """
    Provisions real starter team accounts (Chef, Waiter, Cashier) for the manager's restaurant workspace.
    """
    rest_res = await db.execute(select(Restaurant).where(Restaurant.id == current_user.restaurant_id))
    rest = rest_res.scalar_one_or_none()
    slug = rest.slug if rest else "workspace"
    default_pass = get_password_hash("team1234")

    starter_roles = [
        (f"chef.{slug}@mezflow.com", f"{rest.name if rest else 'Kitchen'} Head Chef", UserRole.KITCHEN_STAFF),
        (f"waiter.{slug}@mezflow.com", f"{rest.name if rest else 'Floor'} Captain", UserRole.SERVICE_STAFF),
        (f"cashier.{slug}@mezflow.com", f"{rest.name if rest else 'Front'} Cashier", UserRole.CASHIER),
    ]

    for s_email, s_name, s_role in starter_roles:
        existing = await db.execute(
            select(User).where(User.restaurant_id == current_user.restaurant_id, User.email == s_email)
        )
        if not existing.scalar_one_or_none():
            u = User(
                restaurant_id=current_user.restaurant_id,
                email=s_email,
                hashed_password=current_user.hashed_password or default_pass,
                role=s_role,
                is_active=True,
                is_verified=True,
            )
            db.add(u)
            await db.flush()
            p = UserProfile(
                user_id=u.id,
                display_name=s_name,
                preferred_language="en",
                push_notifications_enabled=True,
            )
            db.add(p)
            await db.flush()

    await db.commit()

    stmt = (
        select(User)
        .options(selectinload(User.profile))
        .where(
            User.restaurant_id == current_user.restaurant_id,
            User.role.in_([UserRole.MANAGER, UserRole.KITCHEN_STAFF, UserRole.SERVICE_STAFF, UserRole.CASHIER]),
        )
        .order_by(User.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(
    data: UserLoginPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticates a user using email/phone and password.
    Supports global staff login (auto-resolving restaurant) or scoped restaurant login.
    (FR-M1-01, FR-M1-02, FR-M1-05)
    """
    clean_username = data.username.strip()

    if data.restaurant_id:
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(
                User.restaurant_id == data.restaurant_id,
                or_(
                    User.email == clean_username,
                    User.phone_number == clean_username,
                ),
            )
        )
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
    else:
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(
                or_(
                    User.email == clean_username,
                    User.phone_number == clean_username,
                ),
            )
        )
        res = await db.execute(stmt)
        users = res.scalars().all()
        if len(users) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple restaurant accounts match this username. Please specify restaurant_id.",
            )
        user = users[0] if users else None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was registered via OTP and does not have a password set. Please use OTP login.",
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    # Record Audit Log
    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=user.restaurant_id,
        user_id=user.id,
        action="USER_LOGIN_PASSWORD",
        resource_type="session",
        resource_id=str(user.id),
        details={"role": user.role.value},
        ip_address=ip,
    )
    await db.commit()

    token = create_access_token(
        subject=str(user.id),
        claims={
            "role": user.role.value,
            "restaurant_id": str(user.restaurant_id),
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user.role.value,
        restaurant_id=user.restaurant_id,
        user_id=user.id,
        display_name=user.profile.display_name if user.profile else None,
        preferred_language=user.profile.preferred_language if user.profile else "en",
    )


@router.post("/request-otp", tags=["Authentication"])
async def request_otp(data: OTPRequest):
    """
    Requests a 6-digit one-time password sent to phone or email.
    (FR-M1-01)
    """
    clean_destination = data.destination.strip().lower()
    code = await OTPService.request_otp(clean_destination)
    return {
        "message": "One-time password dispatched successfully.",
        "destination": clean_destination,
        # For development / testing convenience, include code ONLY in local development with DEBUG enabled
        "debug_otp": code if (settings.ENVIRONMENT == "development" and settings.DEBUG) else None,
    }


@router.post("/verify-otp", response_model=TokenResponse, tags=["Authentication"])
async def verify_otp(
    data: OTPVerifyLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verifies OTP code and authenticates the user.
    Creates account automatically if it does not yet exist.
    (FR-M1-01, FR-M1-02)
    """
    is_valid, error_msg = await OTPService.verify_otp(data.destination, data.code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg or "Invalid or expired OTP code.",
        )

    clean_dest = data.destination.strip()
    is_email = "@" in clean_dest

    # Resolve target restaurant and existing user
    if data.restaurant_id:
        target_restaurant_id = data.restaurant_id
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(
                User.restaurant_id == target_restaurant_id,
                or_(
                    User.email == clean_dest,
                    User.phone_number == clean_dest,
                ),
            )
        )
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
    else:
        stmt = (
            select(User)
            .options(selectinload(User.profile))
            .where(
                or_(
                    User.email == clean_dest,
                    User.phone_number == clean_dest,
                ),
            )
        )
        res = await db.execute(stmt)
        users = res.scalars().all()
        if len(users) > 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple restaurant accounts match this destination. Please specify restaurant_id.",
            )
        user = users[0] if users else None
        if user:
            target_restaurant_id = user.restaurant_id
        else:
            rest_res = await db.execute(select(Restaurant).where(Restaurant.is_active == True).limit(1))
            default_rest = rest_res.scalar_one_or_none()
            if not default_rest:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No active restaurant found. Please provide restaurant_id.",
                )
            target_restaurant_id = default_rest.id

    # Security check: OTP is strictly for Customers, not Staff or Managers
    if user and user.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff and management accounts cannot authenticate using customer OTP. Please use staff password login.",
        )

    if not user:
        # Create user verified by OTP with NO usable password
        user = User(
            restaurant_id=target_restaurant_id,
            email=clean_dest if is_email else None,
            phone_number=clean_dest if not is_email else None,
            hashed_password=None,  # OTP accounts have no usable password; must authenticate via OTP
            role=UserRole.CUSTOMER,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        profile = UserProfile(
            user_id=user.id,
            display_name=f"Guest {clean_dest[-4:]}",
            preferred_language="en",
            push_notifications_enabled=True,
        )
        db.add(profile)
        await db.flush()
    else:
        user.is_verified = True
        await db.flush()

    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=target_restaurant_id,
        user_id=user.id,
        action="USER_LOGIN_OTP",
        resource_type="session",
        resource_id=str(user.id),
        details={"destination": clean_dest},
        ip_address=ip,
    )
    await db.commit()

    # Eagerly load user with profile
    stmt = (
        select(User)
        .options(selectinload(User.profile))
        .where(User.id == user.id)
    )
    res = await db.execute(stmt)
    user_loaded = res.scalar_one()

    token = create_access_token(
        subject=str(user_loaded.id),
        claims={
            "role": user_loaded.role.value,
            "restaurant_id": str(user_loaded.restaurant_id),
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=user_loaded.role.value,
        restaurant_id=user_loaded.restaurant_id,
        user_id=user_loaded.id,
        display_name=user_loaded.profile.display_name if user_loaded.profile else None,
        preferred_language=user_loaded.profile.preferred_language if user_loaded.profile else "en",
    )


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the authenticated user details and profile.
    (FR-M1-02, FR-M1-03)
    """
    return current_user


@router.post("/refresh", response_model=TokenResponse, tags=["Authentication"])
async def refresh_token(current_user: User = Depends(get_current_user)):
    """
    Refreshes an active session token before expiration.
    (FR-M1-02)
    """
    token = create_access_token(
        subject=str(current_user.id),
        claims={
            "role": current_user.role.value,
            "restaurant_id": str(current_user.restaurant_id),
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=current_user.role.value,
        restaurant_id=current_user.restaurant_id,
        user_id=current_user.id,
        display_name=current_user.profile.display_name if current_user.profile else None,
        preferred_language=current_user.profile.preferred_language if current_user.profile else "en",
    )


@router.patch("/profile", response_model=UserProfileResponse, tags=["Authentication"])
async def update_profile(
    data: UserProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates user display name, preferred language (English or Urdu), and notification preferences.
    (FR-M1-04, NFR-12)
    """
    profile = current_user.profile
    if not profile:
        profile = UserProfile(
            user_id=current_user.id,
            display_name=data.display_name or "User",
            preferred_language=data.preferred_language or "en",
            push_notifications_enabled=True,
        )
        db.add(profile)
    else:
        if data.display_name is not None:
            profile.display_name = data.display_name
        if data.preferred_language is not None:
            profile.preferred_language = data.preferred_language
        if data.push_notifications_enabled is not None:
            profile.push_notifications_enabled = data.push_notifications_enabled

    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=current_user.restaurant_id,
        user_id=current_user.id,
        action="PROFILE_UPDATED",
        resource_type="user_profile",
        resource_id=str(profile.id),
        details=data.model_dump(exclude_unset=True),
        ip_address=ip,
    )
    await db.commit()
    await db.refresh(profile)

    return profile


@router.get("/audit-logs", response_model=List[AuditLogResponse], tags=["Administration"])
async def list_audit_logs(
    restaurant_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_roles([UserRole.MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists immutable audit log entries for the tenant restaurant.
    Restricted to Manager role only. Enforces multi-tenant data isolation.
    (FR-M1-06, FR-M1-07, NFR-08, NFR-10)
    """
    if restaurant_id is not None:
        enforce_tenant(restaurant_id, current_user)

    target_restaurant_id = restaurant_id or current_user.restaurant_id
    stmt = (
        select(AuditLog)
        .where(AuditLog.restaurant_id == target_restaurant_id)
        .order_by(desc(AuditLog.created_at))
        .offset(offset)
        .limit(min(limit, 100))
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "/register-restaurant",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication", "Multi-Tenancy"],
    summary="Register a brand-new restaurant workspace with Manager credentials",
)
async def register_restaurant(
    data: RestaurantRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Provisions a new isolated multi-tenant restaurant workspace in PostgreSQL:
    - Creates Restaurant record with unique URL slug.
    - Creates Manager User account with secure bcrypt hashed password.
    - Seeds 10 starter dining tables with QR code tokens.
    - Seeds starter menu categories.
    - Issues an authenticated JWT session token.
    (FR-M1-01, FR-M1-05, Multi-Tenancy)
    """
    clean_email = data.email.strip().lower()

    if not data.password and not data.clerk_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either password or verified Clerk user ID must be provided.",
        )

    # 1. Check if user or clerk_user_id already registered
    existing_user_stmt = select(User).options(selectinload(User.restaurant), selectinload(User.profile)).where(
        or_(
            User.email == clean_email,
            User.clerk_user_id == data.clerk_user_id if data.clerk_user_id else False,
        )
    )
    existing_user_res = await db.execute(existing_user_stmt)
    existing_user = existing_user_res.scalar_one_or_none()

    if existing_user and existing_user.restaurant_id:
        # If user is already registered via Clerk and has a restaurant, return token directly
        token = create_access_token(
            subject=str(existing_user.id),
            claims={
                "role": existing_user.role.value,
                "restaurant_id": str(existing_user.restaurant_id),
            },
        )
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            role=existing_user.role.value,
            restaurant_id=existing_user.restaurant_id,
            user_id=existing_user.id,
            display_name=existing_user.profile.display_name if existing_user.profile else data.manager_name,
            preferred_language=existing_user.profile.preferred_language if existing_user.profile else "en",
        )

    # 2. Derive unique restaurant slug
    base_slug = re.sub(r"[^a-z0-9]+", "-", data.restaurant_name.strip().lower()).strip("-")
    if not base_slug:
        base_slug = "restaurant"
    candidate_slug = base_slug
    suffix = 1
    while True:
        existing_slug = await db.execute(select(Restaurant).where(Restaurant.slug == candidate_slug))
        if not existing_slug.scalar_one_or_none():
            break
        suffix += 1
        candidate_slug = f"{base_slug}-{suffix}"

    # 3. Create Restaurant
    clerk_org_id = data.clerk_org_id or (f"org_{data.clerk_user_id[-8:]}" if data.clerk_user_id else None)
    restaurant = Restaurant(
        name=data.restaurant_name.strip(),
        slug=candidate_slug,
        address=data.address,
        phone=data.phone,
        currency=data.currency.upper(),
        clerk_org_id=clerk_org_id,
        is_active=True,
    )
    db.add(restaurant)
    await db.flush()

    # 4. Create or link Manager User
    hashed_pwd = get_password_hash(data.password) if data.password else get_password_hash(secrets.token_urlsafe(32))
    if existing_user:
        existing_user.restaurant_id = restaurant.id
        existing_user.role = UserRole.MANAGER
        if data.clerk_user_id and not existing_user.clerk_user_id:
            existing_user.clerk_user_id = data.clerk_user_id
        manager_user = existing_user
    else:
        manager_user = User(
            restaurant_id=restaurant.id,
            email=clean_email,
            phone_number=data.phone,
            hashed_password=hashed_pwd,
            clerk_user_id=data.clerk_user_id,
            role=UserRole.MANAGER,
            is_active=True,
            is_verified=True,
        )
        db.add(manager_user)
        await db.flush()

        profile = UserProfile(
            user_id=manager_user.id,
            display_name=data.manager_name.strip(),
            preferred_language="en",
            push_notifications_enabled=True,
        )
        db.add(profile)
    await db.flush()

    # 4b. Seed Real Starter Team Profiles for this restaurant
    starter_team = [
        (f"chef.{candidate_slug}@mezflow.com", f"{data.restaurant_name.strip()} Head Chef", UserRole.KITCHEN_STAFF),
        (f"waiter.{candidate_slug}@mezflow.com", f"{data.restaurant_name.strip()} Floor Captain", UserRole.SERVICE_STAFF),
        (f"cashier.{candidate_slug}@mezflow.com", f"{data.restaurant_name.strip()} Cashier Station", UserRole.CASHIER),
    ]
    for s_email, s_name, s_role in starter_team:
        s_user = User(
            restaurant_id=restaurant.id,
            email=s_email,
            hashed_password=hashed_pwd,
            role=s_role,
            is_active=True,
            is_verified=True,
        )
        db.add(s_user)
        await db.flush()
        db.add(
            UserProfile(
                user_id=s_user.id,
                display_name=s_name,
                preferred_language="en",
                push_notifications_enabled=True,
            )
        )
    await db.flush()

    # 5. Seed 10 starter dining tables with QR code tokens
    for t_num in range(1, 11):
        db.add(
            Table(
                restaurant_id=restaurant.id,
                table_number=t_num,
                capacity=4,
                status=TableStatus.AVAILABLE,
                qr_code_token=f"QR-{candidate_slug}-T{t_num}-{secrets.token_hex(3).upper()}",
            )
        )

    # 6. Seed starter menu categories and initial dishes
    cat_objs = []
    categories = [
        ("Starters & Appetizers", 1),
        ("Main Course", 2),
        ("Beverages & Drinks", 3),
        ("Desserts", 4),
    ]
    for cat_name, order in categories:
        c_obj = MenuCategory(restaurant_id=restaurant.id, name=cat_name, sort_order=order)
        db.add(c_obj)
        cat_objs.append(c_obj)
    await db.flush()

    # Seed starter dishes
    initial_dishes = [
        {
            "category_id": cat_objs[0].id,
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
            "category_id": cat_objs[0].id,
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
            "category_id": cat_objs[1].id,
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
            "category_id": cat_objs[1].id,
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
            "category_id": cat_objs[2].id,
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
            "category_id": cat_objs[2].id,
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
            "category_id": cat_objs[3].id,
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
            "category_id": cat_objs[3].id,
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
    for d_item in initial_dishes:
        db.add(MenuItem(restaurant_id=restaurant.id, **d_item))

    # 7. Record immutable audit log
    ip = _get_client_ip(request)
    await record_audit_log(
        db=db,
        restaurant_id=restaurant.id,
        user_id=manager_user.id,
        action="RESTAURANT_REGISTERED",
        resource_type="restaurant",
        resource_id=str(restaurant.id),
        details={"restaurant_name": restaurant.name, "slug": restaurant.slug, "email": clean_email},
        ip_address=ip,
    )

    await db.commit()

    # 8. Issue authenticated session token
    token = create_access_token(
        subject=str(manager_user.id),
        claims={
            "role": manager_user.role.value,
            "restaurant_id": str(restaurant.id),
        },
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        role=manager_user.role.value,
        restaurant_id=restaurant.id,
        user_id=manager_user.id,
        display_name=profile.display_name,
        preferred_language=profile.preferred_language,
    )


@router.post(
    "/onboarding",
    tags=["Authentication", "Multi-Tenancy"],
    summary="Update restaurant profile and manager preferences during onboarding",
)
async def update_onboarding(
    data: OnboardingRequest,
    current_user: User = Depends(require_roles([UserRole.MANAGER])),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows a newly registered or Clerk-authenticated Manager to customize
    their restaurant details (name, address, phone, currency) and display name.
    """
    rest_stmt = select(Restaurant).where(Restaurant.id == current_user.restaurant_id)
    restaurant = (await db.execute(rest_stmt)).scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found.")

    if data.restaurant_name:
        restaurant.name = data.restaurant_name.strip()
    if data.address is not None:
        restaurant.address = data.address.strip()
    if data.phone is not None:
        restaurant.phone = data.phone.strip()
    if data.currency:
        restaurant.currency = data.currency.upper().strip()

    if data.display_name and current_user.profile:
        current_user.profile.display_name = data.display_name.strip()

    await db.commit()
    return {
        "message": "Restaurant onboarding details saved successfully.",
        "restaurant_id": str(restaurant.id),
        "restaurant_name": restaurant.name,
        "currency": restaurant.currency,
    }
