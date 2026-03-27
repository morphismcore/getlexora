"""
Lexora SQLAlchemy ORM Modelleri.
Türk avukatları için dava yönetimi ve hukuk araştırma veritabanı şeması.
"""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    Date,
    DateTime,
    ForeignKey,
    Index,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.types import LargeBinary
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)


class Base(DeclarativeBase):
    pass


class Firm(Base):
    """Hukuk bürosu tablosu — çoklu avukat yönetimi için."""

    __tablename__ = "firms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    max_users: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    firm_type: Mapped[str] = mapped_column(
        String(20), default="kurumsal", nullable=False
    )  # kurumsal, bireysel
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    members: Mapped[list["User"]] = relationship(back_populates="firm")

    def __repr__(self) -> str:
        return f"<Firm {self.name}>"


class User(Base):
    """Avukat / kullanıcı tablosu."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    baro_sicil_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    baro: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="kullanici", nullable=False)  # admin, yonetici, kullanici
    firm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firms.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    firm: Mapped["Firm | None"] = relationship(back_populates="members")
    cases: Mapped[list["Case"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    saved_searches: Mapped[list["SavedSearch"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class Case(Base):
    """Dava dosyası tablosu."""

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    case_type: Mapped[str] = mapped_column(String(50), nullable=False)  # is_hukuku, ceza, ticaret, idare, aile
    court: Mapped[str | None] = mapped_column(String(255), nullable=True)
    case_number: Mapped[str | None] = mapped_column(String(100), nullable=True)  # esas numarası
    opponent: Mapped[str | None] = mapped_column(String(255), nullable=True)  # karşı taraf
    assigned_to: Mapped[str | None] = mapped_column(String(500), nullable=True)  # atanan avukat adları (virgülle ayrılmış)
    firm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("firms.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="aktif", nullable=False)  # aktif, kapandi, beklemede
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="cases")
    documents: Mapped[list["CaseDocument"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    saved_searches: Mapped[list["SavedSearch"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    deadlines: Mapped[list["Deadline"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )
    events: Mapped[list["CaseEvent"]] = relationship(
        back_populates="case", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_cases_user_id", "user_id"),
        Index("ix_cases_status", "status"),
        Index("ix_cases_firm_id", "firm_id"),
    )

    def __repr__(self) -> str:
        return f"<Case {self.title}>"


class CaseDocument(Base):
    """Dava belgesi tablosu."""

    __tablename__ = "case_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, docx, udf
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    document_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # dilekce, karar, bilirkisi_raporu, sozlesme, diger
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="documents")

    __table_args__ = (Index("ix_case_documents_case_id", "case_id"),)

    def __repr__(self) -> str:
        return f"<CaseDocument {self.file_name}>"


class SavedSearch(Base):
    """Kayıtlı arama tablosu."""

    __tablename__ = "saved_searches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    case_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="SET NULL"), nullable=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    search_type: Mapped[str] = mapped_column(String(20), nullable=False)  # ictihat, mevzuat
    result_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="saved_searches")
    case: Mapped["Case | None"] = relationship(back_populates="saved_searches")

    __table_args__ = (Index("ix_saved_searches_user_id", "user_id"),)

    def __repr__(self) -> str:
        return f"<SavedSearch '{self.query[:30]}...'>"


class CaseEvent(Base):
    """Dava olayı tablosu — süre hesaplaması tetikleyicisi."""

    __tablename__ = "case_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "karar_teblig", "dava_acilma"
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="events")
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])
    deadlines: Mapped[list["Deadline"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_case_events_case_id", "case_id"),
    )

    def __repr__(self) -> str:
        return f"<CaseEvent {self.event_type} @ {self.event_date}>"


class Deadline(Base):
    """Hak düşürücü süre / takvim tablosu."""

    __tablename__ = "deadlines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    deadline_date: Mapped[date] = mapped_column(Date, nullable=False)
    deadline_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # hak_dusurucusu, zamanasimai, durusma, diger
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Event-based deadline fields
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_events.id", ondelete="SET NULL"), nullable=True
    )
    original_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_manual_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    override_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    override_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    law_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    duration_text: Mapped[str | None] = mapped_column(String(100), nullable=True)
    calculation_detail: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON text

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="deadlines")
    event: Mapped["CaseEvent | None"] = relationship(back_populates="deadlines")
    overrider: Mapped["User | None"] = relationship(foreign_keys=[override_by])

    __table_args__ = (
        Index("ix_deadlines_case_id", "case_id"),
        Index("ix_deadlines_deadline_date", "deadline_date"),
        Index("ix_deadlines_event_id", "event_id"),
    )

    def __repr__(self) -> str:
        return f"<Deadline {self.title} @ {self.deadline_date}>"


class PasswordResetToken(Base):
    """Şifre sıfırlama token tablosu."""

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<PasswordResetToken user_id={self.user_id}>"


class NotificationPreference(Base):
    """Kullanıcı bildirim tercihleri tablosu."""

    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    email_deadline_reminder: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_case_update: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email_weekly_summary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_days_before: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship()

    def __repr__(self) -> str:
        return f"<NotificationPreference user_id={self.user_id}>"


# ── Admin-Configurable Deadline Rules ─────────────────────────────────────


class EventTypeDefinition(Base):
    """Admin tarafından yapılandırılabilen olay türleri."""

    __tablename__ = "event_type_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    rules: Mapped[list["DeadlineRuleDefinition"]] = relationship(
        back_populates="event_type", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<EventTypeDefinition {self.slug}>"


class DeadlineRuleDefinition(Base):
    """Admin tarafından yapılandırılabilen süre kuralları."""

    __tablename__ = "deadline_rule_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_type_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    law_reference: Mapped[str | None] = mapped_column(String(200), nullable=True)
    law_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_value: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    duration_display: Mapped[str | None] = mapped_column(String(100), nullable=True)
    deadline_type: Mapped[str] = mapped_column(String(50), nullable=False)
    affected_by_adli_tatil: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    affected_by_holidays: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    event_type: Mapped["EventTypeDefinition"] = relationship(back_populates="rules")

    __table_args__ = (
        Index("ix_deadline_rule_definitions_event_type_id", "event_type_id"),
    )

    def __repr__(self) -> str:
        return f"<DeadlineRuleDefinition {self.name}>"


class PublicHoliday(Base):
    """Admin tarafından yapılandırılabilen resmi tatiller."""

    __tablename__ = "public_holidays"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    is_half_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    holiday_type: Mapped[str] = mapped_column(String(50), default="resmi", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_public_holidays_year_date", "year", "date"),
    )

    def __repr__(self) -> str:
        return f"<PublicHoliday {self.name} @ {self.date}>"


class JudicialRecess(Base):
    """Admin tarafından yapılandırılabilen adli tatil dönemleri."""

    __tablename__ = "judicial_recesses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    extension_days_hukuk: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    extension_days_ceza: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    extension_days_idari: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<JudicialRecess {self.year}>"


# ── Decisions & Ingestion ──────────────────────────────────────────────────


class Decision(Base):
    """İçtihat kararları — PostgreSQL'de tam metin saklama."""
    __tablename__ = "decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dedup_hash: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    kaynak: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(200), nullable=False)
    mahkeme: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    daire: Mapped[str | None] = mapped_column(String(200), nullable=True)
    esas_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    karar_no: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    tarih: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    tarih_str: Mapped[str | None] = mapped_column(String(20), nullable=True)
    raw_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    cleaned_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str] = mapped_column(String(20), default="text/html", nullable=False)
    pdf_data = mapped_column(LargeBinary, nullable=True)
    source_meta = mapped_column(JSONB, default=dict, nullable=False)
    search_vector = Column(TSVECTOR)
    is_embedded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    embedded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    ingestion_logs: Mapped[list["IngestionLog"]] = relationship(back_populates="decision")

    __table_args__ = (
        Index("ix_decisions_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_decisions_mahkeme_tarih", "mahkeme", "tarih"),
        Index("ix_decisions_kaynak_mahkeme", "kaynak", "mahkeme"),
        Index("ix_decisions_source_id", "source_id"),
        Index("ix_decisions_not_embedded", "is_embedded", postgresql_where=text("is_embedded = false")),
    )


class IngestionLog(Base):
    """Veri çekme girişimlerinin logu."""
    __tablename__ = "ingestion_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kaynak: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    source_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mahkeme: Mapped[str | None] = mapped_column(String(100), nullable=True)
    daire: Mapped[str | None] = mapped_column(String(200), nullable=True)
    page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    can_retry: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("decisions.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    decision: Mapped["Decision | None"] = relationship(back_populates="ingestion_logs")


class DaireProgress(Base):
    """Daire bazlı ingestion ilerleme takibi."""
    __tablename__ = "daire_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kaynak: Mapped[str] = mapped_column(String(20), nullable=False)  # bedesten/aym/aihm
    mahkeme: Mapped[str] = mapped_column(String(100), nullable=False)  # Yargıtay/Danıştay
    daire: Mapped[str] = mapped_column(String(200), nullable=False)  # 1. Hukuk Dairesi
    item_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # YARGITAYKARARI

    # İlerleme
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    # pending / active / done / error
    total_api: Mapped[int | None] = mapped_column(Integer, nullable=True)  # API'deki toplam karar
    last_page: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_pages: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Toplam sayfa (total_api / 10)
    decisions_saved: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    decisions_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    errors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Zaman
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_activity: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_daire_progress_kaynak_mahkeme", "kaynak", "mahkeme"),
        Index("ix_daire_progress_status", "status"),
        # Unique per daire
        Index("uq_daire_progress", "kaynak", "mahkeme", "daire", unique=True),
    )
