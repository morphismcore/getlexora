"""
Tests for health and root endpoints.
"""

import pytest


class TestHealthEndpoint:
    async def test_health_endpoint(self, client):
        """GET /health returns 200 with status ok."""
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "lexora-backend"

    async def test_root_endpoint(self, client):
        """GET / returns app info."""
        resp = await client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Lexora API"
        assert data["version"] == "0.1.0"
        assert "docs" in data
