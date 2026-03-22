"""
Tests for DeadlineCalculator — Türk hukuk sistemi süre hesaplama.
"""

import pytest
from datetime import date
from app.services.deadline_calculator import DeadlineCalculator


@pytest.fixture
def calc():
    return DeadlineCalculator()


# ── Holiday & Business Day Tests ──────────────────────────

class TestHolidayDetection:
    def test_fixed_holiday_jan1(self, calc):
        assert calc.is_holiday(date(2026, 1, 1)) is True

    def test_fixed_holiday_apr23(self, calc):
        assert calc.is_holiday(date(2026, 4, 23)) is True

    def test_fixed_holiday_may1(self, calc):
        assert calc.is_holiday(date(2026, 5, 1)) is True

    def test_fixed_holiday_oct29(self, calc):
        assert calc.is_holiday(date(2026, 10, 29)) is True

    def test_regular_weekday_not_holiday(self, calc):
        # 2026-03-23 is Monday, no holiday
        assert calc.is_holiday(date(2026, 3, 23)) is False

    def test_religious_holiday_2026_ramazan(self, calc):
        assert calc.is_holiday(date(2026, 3, 20)) is True
        assert calc.is_holiday(date(2026, 3, 21)) is True

    def test_religious_holiday_2026_kurban(self, calc):
        assert calc.is_holiday(date(2026, 5, 27)) is True


class TestBusinessDay:
    def test_weekday_is_business_day(self, calc):
        # 2026-03-23 = Monday
        assert calc.is_business_day(date(2026, 3, 23)) is True

    def test_saturday_not_business_day(self, calc):
        # 2026-03-21 = Saturday
        assert calc.is_business_day(date(2026, 3, 21)) is False

    def test_sunday_not_business_day(self, calc):
        # 2026-03-22 = Sunday
        assert calc.is_business_day(date(2026, 3, 22)) is False

    def test_holiday_not_business_day(self, calc):
        assert calc.is_business_day(date(2026, 1, 1)) is False

    def test_add_business_days(self, calc):
        # Monday + 5 business days = next Monday
        result = calc.add_business_days(date(2026, 3, 23), 5)
        assert result == date(2026, 3, 30)

    def test_add_business_days_over_weekend(self, calc):
        # Friday + 1 business day = Monday
        result = calc.add_business_days(date(2026, 3, 27), 1)
        assert result == date(2026, 3, 30)

    def test_next_business_day_on_weekend(self, calc):
        # Saturday -> Monday
        result = calc.next_business_day(date(2026, 3, 21))
        assert result == date(2026, 3, 23)

    def test_next_business_day_on_weekday(self, calc):
        result = calc.next_business_day(date(2026, 3, 23))
        assert result == date(2026, 3, 23)


# ── Deadline Calculation Tests ────────────────────────────

class TestDeadlineCalculation:
    def test_karar_teblig_returns_results(self, calc):
        result = calc.calculate_deadline("karar_teblig", date(2026, 3, 23))
        assert "deadlines" in result
        assert len(result["deadlines"]) > 0

    def test_ceza_karar_teblig_returns_results(self, calc):
        result = calc.calculate_deadline("ceza_karar_teblig", date(2026, 3, 23))
        assert "deadlines" in result
        assert len(result["deadlines"]) > 0

    def test_fesih_bildirimi_returns_results(self, calc):
        result = calc.calculate_deadline("fesih_bildirimi", date(2026, 3, 23))
        assert "deadlines" in result

    def test_is_kazasi_returns_results(self, calc):
        result = calc.calculate_deadline("is_kazasi", date(2026, 3, 23))
        assert "deadlines" in result

    def test_dava_acilma_returns_results(self, calc):
        result = calc.calculate_deadline("dava_acilma", date(2026, 3, 23))
        assert "deadlines" in result

    def test_kira_sozlesmesi_returns_results(self, calc):
        result = calc.calculate_deadline("kira_sozlesmesi", date(2026, 3, 23))
        assert "deadlines" in result

    def test_icra_takibi_returns_results(self, calc):
        result = calc.calculate_deadline("icra_takibi", date(2026, 3, 23))
        assert "deadlines" in result

    def test_bosanma_returns_results(self, calc):
        result = calc.calculate_deadline("bosanma", date(2026, 3, 23))
        assert "deadlines" in result

    def test_idari_islem_returns_results(self, calc):
        result = calc.calculate_deadline("idari_islem", date(2026, 3, 23))
        assert "deadlines" in result

    def test_unknown_event_type(self, calc):
        result = calc.calculate_deadline("nonexistent", date(2026, 3, 23))
        assert "error" in result or "deadlines" in result

    def test_deadline_has_required_fields(self, calc):
        result = calc.calculate_deadline("karar_teblig", date(2026, 3, 23))
        for dl in result["deadlines"]:
            assert any(k in dl for k in ("title", "label", "name"))
            assert "deadline_date" in dl or "date" in dl

    def test_deadlines_are_after_event_date(self, calc):
        event = date(2026, 3, 23)
        result = calc.calculate_deadline("karar_teblig", event)
        for dl in result["deadlines"]:
            dl_date = dl.get("date") or dl.get("deadline_date")
            if isinstance(dl_date, str):
                from datetime import datetime
                dl_date = datetime.strptime(dl_date, "%Y-%m-%d").date()
            assert dl_date >= event

    def test_deadline_not_on_weekend(self, calc):
        """Süreler hafta sonuna denk gelirse sonraki iş gününe kaymalı."""
        result = calc.calculate_deadline("karar_teblig", date(2026, 3, 23))
        for dl in result["deadlines"]:
            dl_date = dl.get("date") or dl.get("deadline_date")
            if isinstance(dl_date, str):
                from datetime import datetime
                dl_date = datetime.strptime(dl_date, "%Y-%m-%d").date()
            # Weekend check
            assert dl_date.weekday() < 5, f"Deadline {dl['label']} falls on weekend: {dl_date}"


class TestEventTypes:
    def test_list_event_types(self, calc):
        types = calc.EVENT_TYPES
        assert len(types) >= 9
        assert "karar_teblig" in types
        assert "fesih_bildirimi" in types
        assert "bosanma" in types