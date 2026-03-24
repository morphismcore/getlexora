"""
Lexora Auth Routes — Kayıt, giriş, profil.
"""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.database import User, Firm, PasswordResetToken
from app.models.db import get_db
from app.services.email_service import send_email, build_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
settings = get_settings()


# ── Login Rate Limiting ──────────────────────────────────────────────

_login_attempts: dict[str, tuple[int, float]] = {}  # email -> (count, first_attempt_time)


def _check_lockout(email: str) -> bool:
    import time
    if email in _login_attempts:
        count, first_time = _login_attempts[email]
        if time.time() - first_time > 1800:  # 30 min reset
            del _login_attempts[email]
            return False
        return count >= 5
    return False


def _record_failed_login(email: str):
    import time
    if email in _login_attempts:
        count, first_time = _login_attempts[email]
        _login_attempts[email] = (count + 1, first_time)
    else:
        _login_attempts[email] = (1, time.time())


def _clear_login_attempts(email: str):
    _login_attempts.pop(email, None)


# ── Pydantic Schemas ──────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    baro_sicil_no: str | None = None
    baro: str | None = None
    phone: str | None = None
    account_type: str = "bireysel"  # "bireysel" veya "firma"
    firma_adi: str | None = None
    firma_vergi_no: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır")
        if not any(c.isupper() for c in v):
            raise ValueError("Şifre en az bir büyük harf içermelidir")
        if not any(c.isdigit() for c in v):
            raise ValueError("Şifre en az bir rakam içermelidir")
        return v


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
    role: str
    firm_id: uuid.UUID | None = None
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

    # Firma hesabı ise otomatik firma oluştur
    if body.account_type == "firma" and body.firma_adi:
        firm = Firm(
            name=body.firma_adi,
            tax_id=body.firma_vergi_no,
        )
        db.add(firm)
        await db.flush()
        user.firm_id = firm.id
        user.role = "admin"
        await db.flush()

    await db.refresh(user)
    return {
        "message": "Kaydınız alındı. Admin onayı bekleniyor.",
        "email": body.email,
        "account_type": body.account_type,
    }


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Giriş yap, JWT token al."""
    # Lockout kontrolü
    if _check_lockout(body.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Hesap geçici olarak kilitlendi. 30 dakika sonra tekrar deneyin.",
        )

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        _record_failed_login(body.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesap devre dışı bırakılmış",
        )

    _clear_login_attempts(body.email)
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Mevcut kullanıcı bilgilerini getir."""
    return current_user


# ── Şifre Sıfırlama ───────────────────────────────────────────────

import secrets
import time as _time

_reset_attempts: dict[str, tuple[int, float]] = {}  # email -> (count, first_time)


def _check_reset_rate_limit(email: str) -> bool:
    """30 dakikada max 3 şifre sıfırlama talebi."""
    if email in _reset_attempts:
        count, first_time = _reset_attempts[email]
        if _time.time() - first_time > 1800:
            del _reset_attempts[email]
            return False
        return count >= 3
    return False


def _record_reset_attempt(email: str):
    if email in _reset_attempts:
        count, first_time = _reset_attempts[email]
        _reset_attempts[email] = (count + 1, first_time)
    else:
        _reset_attempts[email] = (1, _time.time())


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Şifre sıfırlama e-postası gönder."""
    # Rate limit
    if _check_reset_rate_limit(body.email):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Cok fazla sifirlama talebi. 30 dakika sonra tekrar deneyin.",
        )

    _record_reset_attempt(body.email)

    # Kullanıcı var mı kontrol et — güvenlik için her zaman aynı mesajı dön
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        # Eski kullanılmamış token'ları iptal et
        old_tokens = await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == user.id,
                PasswordResetToken.used == False,
            )
        )
        for old_token in old_tokens.scalars().all():
            old_token.used = True

        # Yeni token oluştur
        raw_token = secrets.token_urlsafe(48)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=raw_token,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset_token)
        await db.flush()

        # E-posta gönder
        reset_url = f"{settings.frontend_url}/sifre-sifirla?token={raw_token}"
        html = build_password_reset_email(reset_url, user.full_name)
        await send_email(user.email, "Lexora - Sifre Sifirlama", html)

    return {"message": "Eger bu e-posta adresine ait bir hesap varsa, sifirlama linki gonderildi."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Token ile şifre sıfırla."""
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used == False,
        )
    )
    token_obj = result.scalar_one_or_none()

    if not token_obj:
        raise HTTPException(status_code=400, detail="Gecersiz veya kullanilmis sifirlama linki")

    if token_obj.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        token_obj.used = True
        await db.flush()
        raise HTTPException(status_code=400, detail="Sifirlama linkinin suresi dolmus. Yeni bir talep olusturun.")

    # Kullanıcıyı bul ve şifreyi güncelle
    user_result = await db.execute(select(User).where(User.id == token_obj.user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Kullanici bulunamadi")

    user.hashed_password = hash_password(body.new_password)
    token_obj.used = True
    await db.flush()

    return {"message": "Sifreniz basariyla degistirildi. Giris yapabilirsiniz."}


# ── Profil & Güvenlik ─────────────────────────────────────


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    baro_sicil_no: str | None = None
    baro: str | None = None


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Profil bilgilerini güncelle."""
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.flush()
    await db.refresh(current_user)
    return current_user


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


@router.put("/password")
async def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Şifre değiştir."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
    current_user.hashed_password = hash_password(body.new_password)
    await db.flush()
    return {"status": "ok", "message": "Şifre başarıyla değiştirildi"}


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

    # max_users kontrolü
    firm_result = await db.execute(select(Firm).where(Firm.id == current_user.firm_id))
    firm = firm_result.scalar_one_or_none()
    if firm:
        member_count = await db.execute(
            select(func.count()).select_from(User).where(User.firm_id == firm.id)
        )
        if (member_count.scalar() or 0) >= firm.max_users:
            raise HTTPException(status_code=400, detail=f"Firma üye limiti doldu ({firm.max_users})")

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


# ── Büro Admin: Üye Yönetimi ─────────────────────────


class FirmRoleUpdateRequest(BaseModel):
    role: str = Field(..., description="partner, avukat, stajyer, asistan")


@router.put("/firm/members/{user_id}/role")
async def update_firm_member_role(
    user_id: uuid.UUID,
    body: FirmRoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Büro admini kendi üyesinin rolünü değiştirsin."""
    if current_user.role not in ("admin", "partner"):
        raise HTTPException(status_code=403, detail="Sadece admin veya partner rol değiştirebilir")
    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Bir firmaya bağlı değilsiniz")

    allowed_roles = {"partner", "avukat", "stajyer", "asistan"}
    if body.role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Geçersiz rol. İzin verilen: {', '.join(allowed_roles)}")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.firm_id != current_user.firm_id:
        raise HTTPException(status_code=404, detail="Kullanıcı firmada bulunamadı")

    user.role = body.role
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} rolü '{body.role}' olarak güncellendi"}


@router.delete("/firm/members/{user_id}")
async def remove_firm_member(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Büro admini üyeyi firmadan çıkarsın."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sadece firma admini üye çıkarabilir")
    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Bir firmaya bağlı değilsiniz")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Kendinizi firmadan çıkaramazsınız")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.firm_id != current_user.firm_id:
        raise HTTPException(status_code=404, detail="Kullanıcı firmada bulunamadı")

    user.firm_id = None
    user.role = "avukat"
    await db.flush()
    return {"status": "ok", "message": f"{user.full_name} firmadan çıkarıldı"}


class FirmUpdateRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    tax_id: str | None = None


@router.put("/firm")
async def update_firm(
    body: FirmUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Büro bilgilerini güncelle (sadece admin)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Sadece firma admini bilgileri güncelleyebilir")
    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Bir firmaya bağlı değilsiniz")

    result = await db.execute(select(Firm).where(Firm.id == current_user.firm_id))
    firm = result.scalar_one_or_none()
    if not firm:
        raise HTTPException(status_code=404, detail="Firma bulunamadı")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(firm, field, value)
    await db.flush()
    return {"status": "ok", "message": "Firma bilgileri güncellendi"}


# ── Büro: Dava & Süre Görünümü ───────────────────────

from app.models.database import Case, Deadline


@router.get("/firm/cases")
async def list_firm_cases(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bürodaki TÜM davaları listele."""
    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Bir firmaya bağlı değilsiniz")

    # Firma üyelerinin ID'lerini al
    members_result = await db.execute(
        select(User.id).where(User.firm_id == current_user.firm_id)
    )
    member_ids = [r[0] for r in members_result.all()]

    # Tüm firma davalarını getir
    cases_result = await db.execute(
        select(Case).where(Case.user_id.in_(member_ids)).order_by(Case.updated_at.desc())
    )
    cases = cases_result.scalars().all()

    return [
        {
            "id": str(c.id),
            "title": c.title,
            "case_type": c.case_type,
            "court": c.court,
            "case_number": c.case_number,
            "opponent": c.opponent,
            "assigned_to": c.assigned_to,
            "status": c.status,
            "user_id": str(c.user_id),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in cases
    ]


@router.get("/firm/deadlines")
async def list_firm_deadlines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bürodaki TÜM yaklaşan süreleri listele."""
    from datetime import date, timedelta

    if not current_user.firm_id:
        raise HTTPException(status_code=400, detail="Bir firmaya bağlı değilsiniz")

    members_result = await db.execute(
        select(User.id).where(User.firm_id == current_user.firm_id)
    )
    member_ids = [r[0] for r in members_result.all()]

    today = date.today()
    month_later = today + timedelta(days=30)

    deadlines_result = await db.execute(
        select(Deadline, Case.title.label("case_title"))
        .join(Case, Deadline.case_id == Case.id)
        .where(
            Case.user_id.in_(member_ids),
            Deadline.deadline_date >= today,
            Deadline.deadline_date <= month_later,
            Deadline.is_completed == False,
        )
        .order_by(Deadline.deadline_date.asc())
    )

    return [
        {
            "id": str(dl.id),
            "title": dl.title,
            "deadline_date": dl.deadline_date.isoformat(),
            "deadline_type": dl.deadline_type,
            "case_title": case_title,
            "case_id": str(dl.case_id),
        }
        for dl, case_title in deadlines_result.all()
    ]
