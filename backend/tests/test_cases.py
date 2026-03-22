"""
Tests for case management models and schemas.
"""

import pytest
import uuid
from datetime import datetime, date

from app.models.database import Case, Deadline, SavedSearch, CaseDocument


class TestCaseModel:
    """Test Case SQLAlchemy model."""

    def test_case_creation(self):
        case = Case(
            title="Test Davası",
            case_type="is_hukuku",
            court="İstanbul 1. İş Mahkemesi",
            case_number="2026/1234",
            opponent="XYZ A.Ş.",
            status="aktif",
            notes="Test notları",
        )
        assert case.title == "Test Davası"
        assert case.case_type == "is_hukuku"
        assert case.status == "aktif"

    def test_case_accepts_explicit_id(self):
        explicit_id = uuid.uuid4()
        case = Case(id=explicit_id, title="Test", case_type="ceza")
        assert case.id == explicit_id

    def test_case_types(self):
        """Valid case types."""
        valid_types = ["is_hukuku", "ceza", "ticaret", "idare", "aile"]
        for ct in valid_types:
            case = Case(title="Test", case_type=ct)
            assert case.case_type == ct

    def test_case_statuses(self):
        """Valid statuses."""
        for status in ["aktif", "kapandi", "beklemede"]:
            case = Case(title="Test", case_type="ceza", status=status)
            assert case.status == status


class TestDeadlineModel:
    def test_deadline_creation(self):
        dl = Deadline(
            title="İstinaf süresi",
            deadline_date=date(2026, 4, 10),
            deadline_type="hak_dusurucusu",
            description="HMK md. 345",
            reminder_days=3,
        )
        assert dl.title == "İstinaf süresi"
        assert dl.deadline_type == "hak_dusurucusu"
        assert dl.reminder_days == 3
        assert dl.is_completed in (False, None)  # Default set by DB server


class TestSavedSearchModel:
    def test_saved_search_creation(self):
        ss = SavedSearch(
            query="işe iade davası",
            search_type="ictihat",
            result_count=10,
        )
        assert ss.query == "işe iade davası"
        assert ss.search_type == "ictihat"
        assert ss.result_count == 10


class TestCaseDocumentModel:
    def test_document_creation(self):
        doc = CaseDocument(
            file_name="dilekce.pdf",
            file_type="pdf",
            file_path="/uploads/dilekce.pdf",
            document_type="dilekce",
        )
        assert doc.file_name == "dilekce.pdf"
        assert doc.document_type == "dilekce"