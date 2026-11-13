from datetime import datetime
from typing import Optional, Any, Dict, Union
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.models.user import UserRole


class UserSignupRequest(BaseModel):
    restaurant_id: UUID
    display_name: str = Field(..., min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=6)
    preferred_language: str = Field("en", pattern="^(en|ur)$")


class StaffCreateRequest(BaseModel):
    restaurant_id: UUID
    display_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: UserRole = Field(..., description="Staff role (manager, kitchen_staff, service_staff, cashier)")
    preferred_language: str = Field("en", pattern="^(en|ur)$")


class UserLoginPasswordRequest(BaseModel):
    restaurant_id: Optional[UUID] = Field(None, description="Optional: specific restaurant scope")
    username: str = Field(..., description="Email address or phone number")
    password: str = Field(..., min_length=4)


class OTPRequest(BaseModel):
    destination: str = Field(..., description="Phone number or email to receive the OTP code")


class OTPVerifyLoginRequest(BaseModel):
    restaurant_id: Optional[UUID] = Field(None, description="Optional restaurant scope (defaults to active tenant)")
    destination: str = Field(..., description="Phone number or email")
    code: str = Field(..., min_length=6, max_length=6, pattern="^[0-9]{6}$")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    restaurant_id: UUID
    user_id: UUID
    display_name: Optional[str] = None
    preferred_language: str = "en"


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
    preferred_language: Optional[str] = Field(None, pattern="^(en|ur)$")
    push_notifications_enabled: Optional[bool] = None


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    preferred_language: str
    push_notifications_enabled: bool


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    email: Optional[str] = None
    phone_number: Optional[str] = None
    role: Union[UserRole, str]
    is_active: bool
    is_verified: bool
    profile: Optional[UserProfileResponse] = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    user_id: Optional[UUID] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime


class RestaurantRegisterRequest(BaseModel):
    restaurant_name: str = Field(..., min_length=2, max_length=255)
    manager_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: Optional[str] = Field(None, min_length=6)
    phone: Optional[str] = None
    address: Optional[str] = None
    currency: str = Field("PKR", min_length=3, max_length=10)
    clerk_user_id: Optional[str] = None
    clerk_org_id: Optional[str] = None


class OnboardingRequest(BaseModel):
    restaurant_name: Optional[str] = Field(None, min_length=2, max_length=255)
    address: Optional[str] = None
    phone: Optional[str] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=10)
    display_name: Optional[str] = Field(None, min_length=2, max_length=100)
