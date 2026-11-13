from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    KITCHEN_STAFF = "kitchen_staff"
    SERVICE_STAFF = "service_staff"
    CASHIER = "cashier"
    MANAGER = "manager"


class User(BaseModel):
    __tablename__ = "users"

    restaurant_id = Column(UUID(as_uuid=True), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False, index=True)
    clerk_user_id = Column(String(128), unique=True, nullable=True, index=True)
    email = Column(String(255), nullable=True, index=True)
    phone_number = Column(String(50), nullable=True, index=True)
    hashed_password = Column(String(255), nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.CUSTOMER, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("restaurant_id", "email", name="uq_users_restaurant_email"),
        UniqueConstraint("restaurant_id", "phone_number", name="uq_users_restaurant_phone"),
    )

    # Relationships
    restaurant = relationship("Restaurant", back_populates="users")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserProfile(BaseModel):
    __tablename__ = "user_profiles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    preferred_language = Column(String(10), default="en", nullable=False)  # 'en' or 'ur'
    push_notifications_enabled = Column(Boolean, default=True, nullable=False)

    # Relationship
    user = relationship("User", back_populates="profile")
