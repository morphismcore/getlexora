"""
Türk hukuk sistemi süre hesaplayıcı.
Hak düşürücü süreler, zamanaşımı, usul süreleri.
İş günü hesabı dahil (resmi tatiller otomatik).

Hybrid approach: DB-driven (EventTypeDefinition, DeadlineRuleDefinition,
PublicHoliday, JudicialRecess) with fallback to hardcoded rules.
"""

from datetime import date, timedelta
from typing import Optional


class DeadlineCalculator:

    # Turkish public holidays (fixed dates) — (month, day)
    FIXED_HOLIDAYS = [
        (1, 1),    # Yılbaşı
        (4, 23),   # Ulusal Egemenlik ve Çocuk Bayramı
        (5, 1),    # Emek ve Dayanışma Günü
        (5, 19),   # Atatürk'ü Anma, Gençlik ve Spor Bayramı
        (7, 15),   # Demokrasi ve Millî Birlik Günü
        (8, 30),   # Zafer Bayramı
        (10, 29),  # Cumhuriyet Bayramı
    ]

    # Religious holidays shift each year — approximate dates by year.
    # Ramazan Bayramı: 3 days, Kurban Bayramı: 4 days
    RELIGIOUS_HOLIDAYS: dict[int, list[tuple[int, int]]] = {
        2025: [
            (3, 30), (3, 31), (4, 1),              # Ramazan Bayramı
            (6, 6), (6, 7), (6, 8), (6, 9),        # Kurban Bayramı
        ],
        2026: [
            (3, 20), (3, 21), (3, 22),             # Ramazan Bayramı
            (5, 27), (5, 28), (5, 29), (5, 30),    # Kurban Bayramı
        ],
        2027: [
            (3, 9), (3, 10), (3, 11),              # Ramazan Bayramı
            (5, 16), (5, 17), (5, 18), (5, 19),    # Kurban Bayramı
        ],
        2028: [
            (2, 27), (2, 28), (2, 29),             # Ramazan Bayramı
            (5, 4), (5, 5), (5, 6), (5, 7),        # Kurban Bayramı
        ],
    }

    # ----- Event type definitions -----

    EVENT_TYPES: dict[str, dict] = {
        "karar_teblig": {
            "label": "Karar Tebliği (Hukuk)",
            "description": "Hukuk mahkemesi kararının tebliğ edilmesi",
        },
        "ceza_karar_teblig": {
            "label": "Karar Tebliği (Ceza)",
            "description": "Ceza mahkemesi kararının tebliğ edilmesi",
        },
        "fesih_bildirimi": {
            "label": "İş Sözleşmesi Fesih Bildirimi",
            "description": "İş sözleşmesinin feshedildiğinin bildirilmesi",
        },
        "is_kazasi": {
            "label": "İş Kazası",
            "description": "İş kazası meydana gelmesi",
        },
        "dava_acilma": {
            "label": "Dava Açılması (Tebliğ)",
            "description": "Dava dilekçesinin davalıya tebliğ edilmesi",
        },
        "kira_sozlesmesi": {
            "label": "Kira Sözleşmesi",
            "description": "Kira sözleşmesi ile ilgili süreler",
        },
        "icra_takibi": {
            "label": "İcra Takibi (Ödeme Emri Tebliği)",
            "description": "Ödeme emrinin borçluya tebliğ edilmesi",
        },
        "bosanma": {
            "label": "Boşanma",
            "description": "Boşanma davası süreleri",
        },
        "idari_islem": {
            "label": "İdari İşlem Tebliği",
            "description": "İdari işlemin ilgilisine tebliğ edilmesi",
        },
        "temyiz_teblig": {
            "label": "Temyiz Süresi (Yargıtay)",
            "description": "Yargıtay'a temyiz başvurusu süresi",
        },
        "istinaf_teblig": {
            "label": "İstinaf Süresi (BAM)",
            "description": "Bölge Adliye Mahkemesi'ne istinaf başvurusu süresi",
        },
        "itiraz_teblig": {
            "label": "İtiraz Süresi",
            "description": "Karara itiraz süresi",
        },
        "karar_duzeltme": {
            "label": "Karar Düzeltme Süresi",
            "description": "Karar düzeltme başvurusu süresi",
        },
        "zamanasimi_is": {
            "label": "Zamanaşımı (İş Hukuku)",
            "description": "İşçi alacakları zamanaşımı süresi",
        },
        "zamanasimi_ceza": {
            "label": "Zamanaşımı (Ceza Hukuku)",
            "description": "Ceza davası zamanaşımı süresi",
        },
    }

    # ----- Constructor (hybrid: optional DB session) -----

    def __init__(self, db_session=None):
        """
        db_session: optional AsyncSession for DB-driven mode.
        If None, all methods use hardcoded rules only.
        """
        self._db = db_session
        self._db_event_types = None   # cache
        self._db_rules = None         # cache
        self._db_holidays = None      # cache
        self._db_recesses = None      # cache

    # ----- Hardcoded holiday / business-day helpers -----

    def is_holiday(self, d: date) -> bool:
        """Resmi tatil mi kontrol et (hardcoded)."""
        md = (d.month, d.day)
        if md in self.FIXED_HOLIDAYS:
            return True
        year_holidays = self.RELIGIOUS_HOLIDAYS.get(d.year, [])
        if md in year_holidays:
            return True
        return False

    def is_holiday_db(self, d: date) -> bool:
        """Check holiday against DB data, fallback to hardcoded."""
        if not self._db_holidays:
            return self.is_holiday(d)
        for h in self._db_holidays:
            if h.date == d:
                return True
        return False

    def _get_holiday_name_db(self, d: date) -> str:
        """Get holiday name from DB, fallback to hardcoded."""
        if not self._db_holidays:
            return self._get_holiday_name(d)
        for h in self._db_holidays:
            if h.date == d:
                return h.name
        return "Resmi tatil"

    def is_business_day(self, d: date) -> bool:
        """İş günü mü (hafta sonu + tatil değil). DB-aware when loaded."""
        if d.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        if self._db_holidays is not None:
            return not self.is_holiday_db(d)
        return not self.is_holiday(d)

    def next_business_day(self, d: date) -> date:
        """Eğer tatilse sonraki iş gününü döndür, değilse aynı günü döndür."""
        while not self.is_business_day(d):
            d += timedelta(days=1)
        return d

    def add_business_days(self, start_date: date, days: int) -> date:
        """İş günü ekle."""
        current = start_date
        added = 0
        while added < days:
            current += timedelta(days=1)
            if self.is_business_day(current):
                added += 1
        return current

    def add_calendar_days(self, start_date: date, days: int) -> date:
        """Takvim günü ekle (süre tatile denk gelirse sonraki iş günü)."""
        result = start_date + timedelta(days=days)
        return self.next_business_day(result)

    def add_weeks(self, start_date: date, weeks: int) -> date:
        """Hafta ekle (süre tatile denk gelirse sonraki iş günü)."""
        result = start_date + timedelta(weeks=weeks)
        return self.next_business_day(result)

    def add_months(self, start_date: date, months: int) -> date:
        """Ay ekle (süre tatile denk gelirse sonraki iş günü)."""
        month = start_date.month - 1 + months
        year = start_date.year + month // 12
        month = month % 12 + 1
        day = min(start_date.day, self._days_in_month(year, month))
        result = date(year, month, day)
        return self.next_business_day(result)

    def add_years(self, start_date: date, years: int) -> date:
        """Yıl ekle (süre tatile denk gelirse sonraki iş günü)."""
        try:
            result = start_date.replace(year=start_date.year + years)
        except ValueError:
            # Feb 29 -> Feb 28
            result = date(start_date.year + years, start_date.month, 28)
        return self.next_business_day(result)

    def business_days_until(self, from_date: date, to_date: date) -> int:
        """İki tarih arasındaki iş günü sayısını hesapla."""
        if to_date <= from_date:
            return 0
        count = 0
        current = from_date + timedelta(days=1)
        while current <= to_date:
            if self.is_business_day(current):
                count += 1
            current += timedelta(days=1)
        return count

    def _urgency(self, deadline_date: date, today: Optional[date] = None) -> str:
        """Aciliyet durumunu hesapla."""
        today = today or date.today()
        days_left = self.business_days_until(today, deadline_date)
        if deadline_date < today:
            return "expired"
        if days_left <= 3:
            return "critical"
        if days_left <= 7:
            return "warning"
        return "normal"

    def _make_deadline(
        self,
        name: str,
        law_reference: str,
        duration: str,
        deadline_date: date,
        note: str = "",
        today: Optional[date] = None,
    ) -> dict:
        today = today or date.today()
        bdays = self.business_days_until(today, deadline_date)
        return {
            "name": name,
            "law_reference": law_reference,
            "duration": duration,
            "deadline_date": deadline_date.isoformat(),
            "business_days_left": bdays,
            "urgency": self._urgency(deadline_date, today),
            "note": note,
        }

    @staticmethod
    def _days_in_month(year: int, month: int) -> int:
        if month == 12:
            return (date(year + 1, 1, 1) - date(year, 12, 1)).days
        return (date(year, month + 1, 1) - date(year, month, 1)).days

    # ----- Event-specific deadline generators -----

    def _karar_teblig(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "İstinaf süresi",
                "HMK md. 345",
                "2 hafta",
                self.add_weeks(event_date, 2),
                "Kararın tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Temyiz süresi",
                "HMK md. 361",
                "2 hafta",
                self.add_weeks(event_date, 2),
                "Kararın tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Karar düzeltme süresi (eski usul)",
                "HUMK md. 440",
                "15 gün",
                self.add_calendar_days(event_date, 15),
                "Kararın tebliğinden itibaren",
                today,
            ),
        ]

    def _ceza_karar_teblig(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "İstinaf süresi",
                "CMK md. 273",
                "7 gün",
                self.add_calendar_days(event_date, 7),
                "Hükmün açıklanmasından/tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Temyiz süresi",
                "CMK md. 291",
                "15 gün",
                self.add_calendar_days(event_date, 15),
                "Kararın tebliğinden itibaren",
                today,
            ),
        ]

    def _fesih_bildirimi(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        arabuluculuk = self.add_months(event_date, 1)
        return [
            self._make_deadline(
                "Arabuluculuk başvuru süresi",
                "4857 sayılı Kanun md. 20",
                "1 ay",
                arabuluculuk,
                "Fesih bildiriminin tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Arabuluculuk sonrası dava açma süresi",
                "7036 sayılı Kanun md. 3",
                "2 hafta",
                self.add_weeks(arabuluculuk, 2),
                "Arabuluculuk son tutanağından itibaren (tahmini)",
                today,
            ),
            self._make_deadline(
                "Kıdem/İhbar tazminatı zamanaşımı",
                "4857 sayılı Kanun md. 32",
                "5 yıl",
                self.add_years(event_date, 5),
                "Fesih tarihinden itibaren",
                today,
            ),
        ]

    def _is_kazasi(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "SGK bildirim süresi",
                "5510 sayılı Kanun md. 13",
                "3 iş günü",
                self.add_business_days(event_date, 3),
                "Kazanın olduğu günden itibaren",
                today,
            ),
            self._make_deadline(
                "Maddi tazminat zamanaşımı",
                "TBK md. 72",
                "2 yıl",
                self.add_years(event_date, 2),
                "Zararın ve failin öğrenilmesinden itibaren",
                today,
            ),
            self._make_deadline(
                "Manevi tazminat zamanaşımı",
                "TBK md. 72",
                "2 yıl",
                self.add_years(event_date, 2),
                "Zararın ve failin öğrenilmesinden itibaren",
                today,
            ),
            self._make_deadline(
                "Ceza zamanaşımı (genel — taksirle yaralama)",
                "TCK md. 66",
                "8 yıl",
                self.add_years(event_date, 8),
                "Suç tarihinden itibaren, suça göre değişir",
                today,
            ),
        ]

    def _dava_acilma(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        cevap = self.add_weeks(event_date, 2)
        cevaba_cevap = self.add_weeks(cevap, 2)
        ikinci_cevap = self.add_weeks(cevaba_cevap, 2)
        return [
            self._make_deadline(
                "Cevap dilekçesi süresi",
                "HMK md. 127",
                "2 hafta",
                cevap,
                "Dava dilekçesinin tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Cevaba cevap dilekçesi süresi",
                "HMK md. 136",
                "2 hafta",
                cevaba_cevap,
                "Cevap dilekçesinin tebliğinden itibaren (tahmini)",
                today,
            ),
            self._make_deadline(
                "İkinci cevap dilekçesi süresi",
                "HMK md. 136",
                "2 hafta",
                ikinci_cevap,
                "Cevaba cevap dilekçesinin tebliğinden itibaren (tahmini)",
                today,
            ),
        ]

    def _kira_sozlesmesi(self, event_date: date, today: Optional[date] = None, **kwargs) -> list[dict]:
        # event_date = kira sözleşmesi başlangıç tarihi
        # kira yılı sonu hesapla
        kira_yil_sonu = event_date.replace(year=event_date.year + 1)
        try:
            kira_yil_sonu = event_date.replace(year=event_date.year + 1)
        except ValueError:
            kira_yil_sonu = date(event_date.year + 1, event_date.month, 28)

        tahliye = self.add_months(kira_yil_sonu, 1)
        # 30 gün önce -> kira tespit
        kira_tespit = kira_yil_sonu - timedelta(days=30)
        kira_tespit = self.next_business_day(kira_tespit)

        return [
            self._make_deadline(
                "Tahliye davası açma süresi",
                "TBK md. 347",
                "Kira yılı sonu + 1 ay",
                tahliye,
                "Kira yılı sonundan itibaren 1 ay içinde",
                today,
            ),
            self._make_deadline(
                "Kira tespit davası",
                "TBK md. 344",
                "Yeni dönemden 30 gün önce",
                kira_tespit,
                "Yeni kira döneminin başlamasından en az 30 gün önce",
                today,
            ),
            self._make_deadline(
                "İhtarname süresi (kira ödenmemesi)",
                "TBK md. 315",
                "30 gün",
                self.add_calendar_days(event_date, 30),
                "Kiracıya 30 günlük süre verilmesi gerekir",
                today,
            ),
        ]

    def _icra_takibi(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "Ödeme emrine itiraz süresi",
                "İİK md. 62",
                "7 gün",
                self.add_calendar_days(event_date, 7),
                "Ödeme emrinin tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "İtirazın iptali davası süresi",
                "İİK md. 67",
                "1 yıl",
                self.add_years(event_date, 1),
                "İtiraz tarihinden itibaren",
                today,
            ),
            self._make_deadline(
                "İtirazın kaldırılması süresi",
                "İİK md. 68",
                "6 ay",
                self.add_months(event_date, 6),
                "İtiraz tarihinden itibaren",
                today,
            ),
        ]

    def _bosanma(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "Aldatma — dava hakkı düşme süresi (öğrenme)",
                "TMK md. 161",
                "6 ay",
                self.add_months(event_date, 6),
                "Aldatmanın öğrenilmesinden itibaren",
                today,
            ),
            self._make_deadline(
                "Aldatma — mutlak hak düşürücü süre",
                "TMK md. 161",
                "5 yıl",
                self.add_years(event_date, 5),
                "Aldatma fiilinin gerçekleşmesinden itibaren",
                today,
            ),
        ]

    def _idari_islem(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        return [
            self._make_deadline(
                "İptal davası açma süresi",
                "İYUK md. 7",
                "60 gün",
                self.add_calendar_days(event_date, 60),
                "İdari işlemin tebliğinden itibaren",
                today,
            ),
            self._make_deadline(
                "Tam yargı davası açma süresi",
                "İYUK md. 12-13",
                "60 gün",
                self.add_calendar_days(event_date, 60),
                "İdari işlemin tebliğinden itibaren",
                today,
            ),
        ]

    # ----- New event handlers -----

    def _temyiz_teblig(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """Temyiz süresi — HMK md. 361: 2 hafta."""
        return [
            self._make_deadline(
                "Temyiz başvuru süresi",
                "HMK md. 361",
                "2 hafta (15 gün)",
                self.add_weeks(event_date, 2),
                "Kararın tebliğinden itibaren Yargıtay'a temyiz başvurusu",
                today,
            ),
        ]

    def _istinaf_teblig(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """İstinaf süresi — HMK md. 345: 2 hafta."""
        return [
            self._make_deadline(
                "İstinaf başvuru süresi",
                "HMK md. 345",
                "2 hafta (14 gün)",
                self.add_weeks(event_date, 2),
                "Kararın tebliğinden itibaren Bölge Adliye Mahkemesi'ne istinaf başvurusu",
                today,
            ),
        ]

    def _itiraz_teblig(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """İtiraz süresi — CMK md. 268: 7 gün."""
        return [
            self._make_deadline(
                "İtiraz süresi",
                "CMK md. 268",
                "7 gün",
                self.add_calendar_days(event_date, 7),
                "Kararın öğrenilmesinden itibaren itiraz başvurusu",
                today,
            ),
        ]

    def _karar_duzeltme(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """Karar düzeltme süresi — HUMK md. 440: 15 gün."""
        return [
            self._make_deadline(
                "Karar düzeltme başvuru süresi",
                "HUMK md. 440",
                "15 gün",
                self.add_calendar_days(event_date, 15),
                "Kararın tebliğinden itibaren karar düzeltme başvurusu",
                today,
            ),
        ]

    def _zamanasimi_is(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """İş hukuku zamanaşımı — İş Kanunu md. 32, 7036 s.K. Geçici md. 1: 5 yıl."""
        return [
            self._make_deadline(
                "İşçi alacakları zamanaşımı",
                "4857 s. İş Kanunu md. 32, 7036 s.K. Geçici md. 1",
                "5 yıl",
                self.add_years(event_date, 5),
                "Alacağın muaccel olduğu tarihten itibaren",
                today,
            ),
            self._make_deadline(
                "Kıdem/İhbar tazminatı zamanaşımı",
                "4857 s. İş Kanunu md. 32",
                "5 yıl",
                self.add_years(event_date, 5),
                "Fesih tarihinden itibaren",
                today,
            ),
        ]

    def _zamanasimi_ceza(self, event_date: date, today: Optional[date] = None) -> list[dict]:
        """Ceza hukuku zamanaşımı — TCK md. 66: suçun ağırlığına göre değişir."""
        return [
            self._make_deadline(
                "Dava zamanaşımı (5 yıldan fazla hapis)",
                "TCK md. 66/1-d",
                "8 yıl",
                self.add_years(event_date, 8),
                "Suç tarihinden itibaren (ağır ceza)",
                today,
            ),
            self._make_deadline(
                "Dava zamanaşımı (5 yıla kadar hapis)",
                "TCK md. 66/1-e",
                "8 yıl",
                self.add_years(event_date, 8),
                "Suç tarihinden itibaren",
                today,
            ),
            self._make_deadline(
                "Dava zamanaşımı (hafif suçlar)",
                "TCK md. 66/1-f",
                "5 yıl",
                self.add_years(event_date, 5),
                "Suç tarihinden itibaren (2 yıla kadar hapis veya adli para)",
                today,
            ),
        ]

    # ----- Main entry point -----

    _HANDLERS = {
        "karar_teblig": "_karar_teblig",
        "ceza_karar_teblig": "_ceza_karar_teblig",
        "fesih_bildirimi": "_fesih_bildirimi",
        "is_kazasi": "_is_kazasi",
        "dava_acilma": "_dava_acilma",
        "kira_sozlesmesi": "_kira_sozlesmesi",
        "icra_takibi": "_icra_takibi",
        "bosanma": "_bosanma",
        "idari_islem": "_idari_islem",
        "temyiz_teblig": "_temyiz_teblig",
        "istinaf_teblig": "_istinaf_teblig",
        "itiraz_teblig": "_itiraz_teblig",
        "karar_duzeltme": "_karar_duzeltme",
        "zamanasimi_is": "_zamanasimi_is",
        "zamanasimi_ceza": "_zamanasimi_ceza",
    }

    def calculate_deadline(self, event_type: str, event_date: date, **kwargs) -> dict:
        """
        Olay tipine göre tüm ilgili süreleri hesapla.

        Returns: {
            "event_type": "karar_teblig",
            "event_date": "2026-03-20",
            "deadlines": [ ... ]
        }
        """
        handler_name = self._HANDLERS.get(event_type)
        if not handler_name:
            return {
                "event_type": event_type,
                "event_date": event_date.isoformat(),
                "error": f"Bilinmeyen olay tipi: {event_type}",
                "deadlines": [],
            }

        handler = getattr(self, handler_name)
        today = kwargs.pop("today", None)
        deadlines = handler(event_date, today=today, **kwargs)

        return {
            "event_type": event_type,
            "event_date": event_date.isoformat(),
            "deadlines": deadlines,
        }

    def get_event_types(self) -> list[dict]:
        """Desteklenen olay tiplerini listele."""
        return [
            {"value": key, "label": info["label"], "description": info["description"]}
            for key, info in self.EVENT_TYPES.items()
        ]

    # ----- Detailed calculation (for event-based system) -----

    def _get_holidays_in_range(self, start: date, end: date) -> list[dict]:
        """Tarih aralığındaki resmi tatilleri döndür."""
        holidays = []
        current = start
        while current <= end:
            if self._db_holidays is not None:
                is_hol = self.is_holiday_db(current)
                name = self._get_holiday_name_db(current) if is_hol else ""
            else:
                is_hol = self.is_holiday(current)
                name = self._get_holiday_name(current) if is_hol else ""
            if is_hol:
                holidays.append({"date": current.isoformat(), "name": name})
            current += timedelta(days=1)
        return holidays

    def _get_weekends_in_range(self, start: date, end: date) -> list[dict]:
        """Tarih aralığındaki hafta sonlarını döndür."""
        weekends = []
        current = start
        while current <= end:
            if current.weekday() >= 5:
                weekends.append({"date": current.isoformat()})
            current += timedelta(days=1)
        return weekends

    def _get_holiday_name(self, d: date) -> str:
        """Tatil gününün adını döndür."""
        md = (d.month, d.day)
        fixed_names = {
            (1, 1): "Yılbaşı",
            (4, 23): "Ulusal Egemenlik ve Çocuk Bayramı",
            (5, 1): "Emek ve Dayanışma Günü",
            (5, 19): "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
            (7, 15): "Demokrasi ve Millî Birlik Günü",
            (8, 30): "Zafer Bayramı",
            (10, 29): "Cumhuriyet Bayramı",
        }
        if md in fixed_names:
            return fixed_names[md]

        year_holidays = self.RELIGIOUS_HOLIDAYS.get(d.year, [])
        if md in year_holidays:
            # Determine if Ramazan or Kurban
            idx = year_holidays.index(md)
            if idx < 3:
                return f"Ramazan Bayramı {idx + 1}. gün"
            else:
                return f"Kurban Bayramı {idx - 3 + 1}. gün"
        return "Resmi tatil"

    def _get_adjustment_reason(self, raw_end: date, adjusted_end: date) -> str | None:
        """Ham tarih ile düzeltilmiş tarih arasındaki farkı açıkla."""
        if raw_end == adjusted_end:
            return None
        day_names_tr = {
            0: "Pazartesi", 1: "Salı", 2: "Çarşamba",
            3: "Perşembe", 4: "Cuma", 5: "Cumartesi", 6: "Pazar",
        }
        reasons = []
        if raw_end.weekday() >= 5:
            reasons.append(f"Son gün {day_names_tr[raw_end.weekday()]}")
        if self._db_holidays is not None:
            if self.is_holiday_db(raw_end):
                reasons.append(f"Son gün {self._get_holiday_name_db(raw_end)}")
        elif self.is_holiday(raw_end):
            reasons.append(f"Son gün {self._get_holiday_name(raw_end)}")
        target_day = day_names_tr[adjusted_end.weekday()]
        reasons.append(f"{target_day}'e uzatıldı")
        return ", ".join(reasons)

    def _parse_duration_info(self, duration_str: str) -> tuple[int, str]:
        """Parse duration string to (days, type). Returns approximate values."""
        dur = duration_str.lower().strip()
        if "hafta" in dur:
            # "2 hafta" or "2 hafta (14 gün)"
            try:
                weeks = int(dur.split()[0])
                return weeks * 7, "takvim_gunu"
            except (ValueError, IndexError):
                return 14, "takvim_gunu"
        if "ay" in dur:
            try:
                months = int(dur.split()[0])
                return months * 30, "takvim_gunu"
            except (ValueError, IndexError):
                return 30, "takvim_gunu"
        if "yıl" in dur:
            try:
                years = int(dur.split()[0])
                return years * 365, "takvim_gunu"
            except (ValueError, IndexError):
                return 365, "takvim_gunu"
        if "iş günü" in dur:
            try:
                days = int(dur.split()[0])
                return days, "is_gunu"
            except (ValueError, IndexError):
                return 7, "is_gunu"
        # Default: calendar days like "7 gün", "15 gün", "60 gün"
        try:
            days = int(dur.split()[0])
            return days, "takvim_gunu"
        except (ValueError, IndexError):
            return 0, "takvim_gunu"

    def calculate_deadline_detail(self, event_type: str, event_date: date, **kwargs) -> dict:
        """
        Olay tipine göre tüm ilgili süreleri DETAYLI hesapla.
        Her süre için tam hesap dökümü döndürür.
        """
        handler_name = self._HANDLERS.get(event_type)
        if not handler_name:
            return {
                "event_type": event_type,
                "event_date": event_date.isoformat(),
                "error": f"Bilinmeyen olay tipi: {event_type}",
                "deadlines": [],
            }

        handler = getattr(self, handler_name)
        today = kwargs.pop("today", None) or date.today()
        basic_deadlines = handler(event_date, today=today, **kwargs)

        detailed_deadlines = []
        for dl in basic_deadlines:
            deadline_date = date.fromisoformat(dl["deadline_date"])
            duration_days, duration_type = self._parse_duration_info(dl["duration"])

            # Calculate raw end date (before weekend/holiday adjustment)
            if duration_type == "is_gunu":
                raw_end = event_date + timedelta(days=duration_days)
            else:
                raw_end = event_date + timedelta(days=duration_days)

            # The adjusted date is the actual deadline
            adjusted_end = deadline_date

            # Get holidays and weekends in the range
            holidays_in_range = self._get_holidays_in_range(event_date, adjusted_end)
            weekends_in_range = self._get_weekends_in_range(event_date, adjusted_end)

            # Adjustment reason
            adjustment_reason = self._get_adjustment_reason(raw_end, adjusted_end)

            # Adli tatil check (July 20 - Sept 1)
            adli_tatil_applied = False
            check = event_date
            while check <= adjusted_end:
                if (check.month == 7 and check.day >= 20) or check.month == 8 or (check.month == 9 and check.day == 1):
                    adli_tatil_applied = True
                    break
                check += timedelta(days=1)

            bdays_left = self.business_days_until(today, deadline_date)
            cdays_left = (deadline_date - today).days if deadline_date >= today else 0

            detail = {
                "name": dl["name"],
                "law_reference": dl["law_reference"],
                "law_text": dl.get("note", ""),
                "duration": dl["duration"],
                "duration_days": duration_days,
                "duration_type": duration_type,
                "start_date": event_date.isoformat(),
                "raw_end_date": raw_end.isoformat(),
                "adjusted_end_date": adjusted_end.isoformat(),
                "deadline_date": deadline_date.isoformat(),
                "adjustment_reason": adjustment_reason,
                "holidays_skipped": holidays_in_range,
                "weekends_in_range": weekends_in_range,
                "adli_tatil_applied": adli_tatil_applied,
                "business_days_left": bdays_left,
                "calendar_days_left": cdays_left,
                "urgency": dl["urgency"],
                "note": dl.get("note", ""),
            }
            detailed_deadlines.append(detail)

        return {
            "event_type": event_type,
            "event_date": event_date.isoformat(),
            "deadlines": detailed_deadlines,
        }

    # =====================================================================
    # DB-driven async methods (hybrid: try DB first, fallback to hardcoded)
    # =====================================================================

    async def _load_from_db(self) -> bool:
        """Load all config from database. Cache for the lifetime of this instance."""
        if self._db is None:
            return False
        # If already loaded, return cached result
        if self._db_event_types is not None:
            return len(self._db_event_types) > 0
        try:
            from app.models.database import (
                EventTypeDefinition,
                DeadlineRuleDefinition,
                PublicHoliday,
                JudicialRecess,
            )
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            # Load event types with rules
            result = await self._db.execute(
                select(EventTypeDefinition)
                .where(EventTypeDefinition.is_active == True)  # noqa: E712
                .options(selectinload(EventTypeDefinition.rules))
                .order_by(EventTypeDefinition.category, EventTypeDefinition.display_order)
            )
            self._db_event_types = result.scalars().all()

            # Load holidays
            result = await self._db.execute(
                select(PublicHoliday).order_by(PublicHoliday.date)
            )
            self._db_holidays = result.scalars().all()

            # Load judicial recesses
            result = await self._db.execute(
                select(JudicialRecess).order_by(JudicialRecess.year)
            )
            self._db_recesses = result.scalars().all()

            return len(self._db_event_types) > 0
        except Exception:
            # DB tables may not exist yet (migration not run) — fall back
            self._db_event_types = None
            self._db_holidays = None
            self._db_recesses = None
            return False

    # ----- DB-driven calculate -----

    async def calculate_deadline_from_db(
        self, event_type_slug: str, event_date: date, today: date | None = None
    ) -> dict:
        """Calculate deadlines using DB rules, fallback to hardcoded."""
        loaded = await self._load_from_db()
        if not loaded:
            return self.calculate_deadline(event_type_slug, event_date, today=today)

        today = today or date.today()

        # Find event type
        evt = None
        for et in self._db_event_types:
            if et.slug == event_type_slug:
                evt = et
                break

        if not evt:
            return {
                "event_type": event_type_slug,
                "event_date": event_date.isoformat(),
                "error": f"Bilinmeyen olay tipi: {event_type_slug}",
                "deadlines": [],
            }

        deadlines = []
        active_rules = [r for r in evt.rules if r.is_active]

        for rule in sorted(active_rules, key=lambda r: r.display_order):
            if rule.duration_unit == "bilgi":
                # Informational only — no deadline date
                deadlines.append(self._make_deadline(
                    rule.name,
                    rule.law_reference or "",
                    rule.duration_display or "Bilgi amaçlı",
                    event_date,
                    rule.note or rule.law_text or "",
                    today,
                ))
                continue

            # Calculate deadline date based on duration
            dl_date = self._calculate_date(event_date, rule.duration_value, rule.duration_unit)

            deadlines.append(self._make_deadline(
                rule.name,
                rule.law_reference or "",
                rule.duration_display or f"{rule.duration_value} {rule.duration_unit}",
                dl_date,
                rule.note or rule.law_text or "",
                today,
            ))

        return {
            "event_type": event_type_slug,
            "event_date": event_date.isoformat(),
            "deadlines": deadlines,
        }

    def _calculate_date(self, start: date, value: int, unit: str) -> date:
        """Calculate a deadline date from start + duration."""
        if unit == "gun":
            return self.add_calendar_days(start, value)
        elif unit == "is_gunu":
            return self.add_business_days(start, value)
        elif unit == "hafta":
            return self.add_weeks(start, value)
        elif unit == "ay":
            return self.add_months(start, value)
        elif unit == "yil":
            return self.add_years(start, value)
        else:
            return self.add_calendar_days(start, value)

    # ----- DB-driven get_event_types -----

    async def get_event_types_from_db(self) -> list[dict]:
        """Get event types from DB, falling back to hardcoded."""
        loaded = await self._load_from_db()
        if not loaded:
            return self.get_event_types()

        result = []
        for et in self._db_event_types:
            active_rules = [r for r in et.rules if r.is_active]
            result.append({
                "value": et.slug,
                "label": et.name,
                "description": et.description or "",
                "category": et.category,
                "rule_count": len(active_rules),
            })
        return result

    # ----- DB-driven detailed calculation -----

    async def calculate_deadline_detail_from_db(
        self, event_type_slug: str, event_date: date, **kwargs
    ) -> dict:
        """Calculate detailed deadlines from DB, with full breakdown."""
        loaded = await self._load_from_db()
        if not loaded:
            return self.calculate_deadline_detail(event_type_slug, event_date, **kwargs)

        today = kwargs.get("today") or date.today()

        # Find event type
        evt = None
        for et in self._db_event_types:
            if et.slug == event_type_slug:
                evt = et
                break

        if not evt:
            return {
                "event_type": event_type_slug,
                "event_date": event_date.isoformat(),
                "error": f"Bilinmeyen olay tipi: {event_type_slug}",
                "deadlines": [],
            }

        detailed_deadlines = []
        active_rules = [r for r in evt.rules if r.is_active]

        for rule in sorted(active_rules, key=lambda r: r.display_order):
            if rule.duration_unit == "bilgi":
                detailed_deadlines.append({
                    "name": rule.name,
                    "law_reference": rule.law_reference or "",
                    "law_text": rule.law_text or rule.note or "",
                    "duration": rule.duration_display or "Bilgi amaçlı",
                    "duration_days": 0,
                    "duration_type": "bilgi",
                    "start_date": event_date.isoformat(),
                    "raw_end_date": event_date.isoformat(),
                    "adjusted_end_date": event_date.isoformat(),
                    "deadline_date": event_date.isoformat(),
                    "adjustment_reason": None,
                    "holidays_skipped": [],
                    "weekends_in_range": [],
                    "adli_tatil_applied": False,
                    "business_days_left": 0,
                    "calendar_days_left": 0,
                    "urgency": "normal",
                    "note": rule.note or "",
                    "is_informational": True,
                })
                continue

            dl_date = self._calculate_date(event_date, rule.duration_value, rule.duration_unit)

            # Raw end (before business day adjustment)
            if rule.duration_unit == "hafta":
                raw_end = event_date + timedelta(weeks=rule.duration_value)
            elif rule.duration_unit == "ay":
                raw_end = self._raw_add_months(event_date, rule.duration_value)
            elif rule.duration_unit == "yil":
                raw_end = self._raw_add_years(event_date, rule.duration_value)
            elif rule.duration_unit == "is_gunu":
                raw_end = event_date + timedelta(days=rule.duration_value)
            else:
                raw_end = event_date + timedelta(days=rule.duration_value)

            holidays_in_range = self._get_holidays_in_range(event_date, dl_date)
            weekends_in_range = self._get_weekends_in_range(event_date, dl_date)
            adjustment_reason = self._get_adjustment_reason(raw_end, dl_date)

            # Check adli tatil
            adli_tatil = self._check_adli_tatil(event_date, dl_date, rule.affected_by_adli_tatil)

            bdays = self.business_days_until(today, dl_date)
            cdays = (dl_date - today).days if dl_date >= today else 0

            detailed_deadlines.append({
                "name": rule.name,
                "law_reference": rule.law_reference or "",
                "law_text": rule.law_text or "",
                "duration": rule.duration_display or f"{rule.duration_value} {rule.duration_unit}",
                "duration_days": rule.duration_value,
                "duration_type": rule.duration_unit,
                "start_date": event_date.isoformat(),
                "raw_end_date": raw_end.isoformat(),
                "adjusted_end_date": dl_date.isoformat(),
                "deadline_date": dl_date.isoformat(),
                "adjustment_reason": adjustment_reason,
                "holidays_skipped": holidays_in_range,
                "weekends_in_range": weekends_in_range,
                "adli_tatil_applied": adli_tatil,
                "business_days_left": bdays,
                "calendar_days_left": cdays,
                "urgency": self._urgency(dl_date, today),
                "note": rule.note or "",
                "deadline_type": rule.deadline_type,
                "affected_by_adli_tatil": rule.affected_by_adli_tatil,
                "affected_by_holidays": rule.affected_by_holidays,
            })

        return {
            "event_type": event_type_slug,
            "event_date": event_date.isoformat(),
            "deadlines": detailed_deadlines,
        }

    # ----- DB-driven helper methods -----

    def _raw_add_months(self, start: date, months: int) -> date:
        """Add months without business day adjustment."""
        month = start.month - 1 + months
        year = start.year + month // 12
        month = month % 12 + 1
        day = min(start.day, self._days_in_month(year, month))
        return date(year, month, day)

    def _raw_add_years(self, start: date, years: int) -> date:
        """Add years without business day adjustment."""
        try:
            return start.replace(year=start.year + years)
        except ValueError:
            return date(start.year + years, start.month, 28)

    def _check_adli_tatil(self, start: date, end: date, affected: bool) -> bool:
        """Check if deadline period overlaps with judicial recess."""
        if not affected:
            return False
        # Check DB recesses first
        if self._db_recesses:
            for recess in self._db_recesses:
                if start <= recess.end_date and end >= recess.start_date:
                    return True
            return False
        # Fallback: standard July 20 - Sept 1
        check = start
        while check <= end:
            if (check.month == 7 and check.day >= 20) or check.month == 8 or (check.month == 9 and check.day == 1):
                return True
            check += timedelta(days=1)
        return False
