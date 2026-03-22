"""
Lexora Auth Routes — Kayıt, giriş, profil.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import User, Firm
from app.models.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
settings = get_settings()


# ── Pydantic Schemas ──────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    baro_sicil_no: str | None = None
    baro: str | None = None
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    baro_sicil_no: str | None
    baro: str | None
    phone: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Helpers ────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """JWT token'dan kullanıcıyı çöz."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı veya devre dışı",
        )
    return user


# ── Routes ─────────────────────────────────────────────────────────────


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Yeni avukat kaydı oluştur."""
    # Check existing
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayıtlı",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        baro_sicil_no=body.baro_sicil_no,
        baro=body.baro,
        phone=body.phone,
        is_active=False,  # Admin onayı gerekli
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return {"message": "Kaydınız alındı. Admin onayı bekleniyor.", "email": body.email}


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Giriş yap, JWT token al."""
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı bırakılmış",
        )

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcı bilgilerini getir."""
    return current_user


# ── Firma Yönetimi ────────────────────────────────────────


class FirmCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=500)
    tax_id: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None


class FirmResponse(BaseModel):
    id: uuid.UUID
    name: str
    tax_id: str | None
    address: str | None
    phone: str | None
    email: str | None
    max_users: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FirmMemberResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.post("/firm", response_model=FirmResponse, status_code=status.HTTP_201_CREATED)
async def create_firm(
    body: FirmCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Yeni hukuk bürosu oluştur ve kurucuyu admin yap."""
    firm = Firm(
        name=body.name,
        tax_id=body.tax_id,
        address=body.address,
        phone=body.phone,
        email=body.email,
    )
    db.add(firm)
    await db.flush()

    # Kurucuyu firma admin'i yap
    current_user.firm_id = firm.id
    current_user.role = "admin"
    await db.flush()
    await db.refresh(firm)
    return firm


@router.get("/firm", response_model=FirmResponse)
async def get_my_firm(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Kullanıcının bağlı olduğu firmayı getir."""
    if not current_user.firm_id:
        raise HTTPException(status_code=404, detail="Bir firmaya bağlı değilsiniz")
    result = await db.execute(select(Firm).where(Firm.id == current_user.firm_id))
    firm = result.scalar_one_or_none()
    if not firm:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")
    return firm


@router.get("/firm/members", response_model=list[FirmMemberResponse])
async def list_firm_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Firmadaki tüm üyeleri listele."""
    if not current_user.firm_id:
        raise HTTPException(status_code=404, detail="Bir firmaya bağlı değilsiniz")
    result = await db.execute(
        select(User).where(User.firm_id == current_user.firm_id, User.is_active == True)
    )
    return result.scalars().all()


class InviteMemberRequest(BaseModel):
    email: EmailStr


@router.post("/firm/invite", status_code=status.HTTP_200_OK)
async def invite_to_firm(
    body: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mevcut kullanıcıyı firmaya davet et (admin/partner only)."""
    if current_user.role not in ("admin", "partner"):
        raise HTTPException(status_code=403, detail="Sadece admin veya partner davet yapabilir")
    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Önce bir firma oluşturun")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Bu e-posta ile kayıtlı kullanıcı bulunamadı")
    if user.firm_id:
        raise HTTPException(status_code=409, detail="Kullanıcı zaten bir firmaya bağlı")

    user.firm_id = current_user.firm_id
    user.role = "avukat"
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} firmaya eklendi"}
