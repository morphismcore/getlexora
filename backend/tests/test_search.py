"""
Tests for search API endpoints.
"""

import pytest


class TestSearchIctihat:
    async def test_search_ictihat_valid_query(self, client):
        """POST /api/v1/search/ictihat with valid query returns results."""
        resp = await client.post(
            "/api/v1/search/ictihat",
            json={"query": "işe iade davası"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sonuclar" in data
        assert "toplam_bulunan" in data
        assert "sure_ms" in data
        assert len(data["sonuclar"]) >= 1

    async def test_search_ictihat_empty_query(self, client):
        """POST /api/v1/search/ictihat with empty query returns 422."""
        resp = await client.post(
            "/api/v1/search/ictihat",
            json={"query": ""},
        )
        assert resp.status_code == 422

    async def test_search_ictihat_short_query(self, client):
        """POST /api/v1/search/ictihat with query < 3 chars returns 422."""
        resp = await client.post(
            "/api/v1/search/ictihat",
            json={"query": "ab"},
        )
        assert resp.status_code == 422


class TestSearchMevzuat:
    async def test_search_mevzuat_by_number(self, client):
        """POST /api/v1/search/mevzuat with kanun_no returns results."""
        resp = await client.post(
            "/api/v1/search/mevzuat",
            json={"kanun_no": "4857"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sonuclar" in data

    async def test_search_mevzuat_by_keyword(self, client):
        """POST /api/v1/search/mevzuat with query returns results."""
        resp = await client.post(
            "/api/v1/search/mevzuat",
            json={"query": "iş kanunu"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "sonuclar" in data


class TestSearchVerify:
    async def test_search_verify(self, client):
        """POST /api/v1/search/verify with text containing citations."""
        resp = await client.post(
            "/api/v1/search/verify",
            json={"text": "Yargıtay 9. HD 2023/1234 E., 2023/5678 K. kararında belirtildiği üzere..."},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "total_citations" in data
        assert "overall_confidence" in data
