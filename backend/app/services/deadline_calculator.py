"""
Türk hukuk sistemi süre hesaplayıcı.
Hak düşürücü süreler, zamanaşımı, usul süreleri.
İş günü hesabı dahil (resmi tatiller otomatik).
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

    def is_holiday(self, d: date) -> bool:
        """Resmi tatil mi kontrol et."""
        md = (d.month, d.day)
        if md in self.FIXED_HOLIDAYS:
            return True
        year_holidays = self.RELIGIOUS_HOLIDAYS.get(d.year, [])
        if md in year_holidays:
            return True
        return False

    def is_business_day(self, d: date) -> bool:
        """İş günü mü (hafta sonu + tatil değil)."""
        if d.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        if self.is_holiday(d):
            return False
        return True

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
