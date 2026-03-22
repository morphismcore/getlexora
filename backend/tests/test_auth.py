"""
Tests for auth routes — register, login, profile.
"""

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from app.api.routes.auth import hash_password, verify_password, create_access_token


# ── Unit Tests ────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_password_returns_string(self):
        result = hash_password("test_password")
        assert isinstance(result, str)
        assert result != "test_password"

    def test_verify_password_correct(self):
        hashed = hash_password("secure_pass_123")
        assert verify_password("secure_pass_123", hashed) is True

    def test_verify_password_wrong(self):
        hashed = hash_password("secure_pass_123")
        assert verify_password("wrong_password", hashed) is False

    def test_hash_password_different_each_time(self):
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2  # bcrypt uses random salt

    def test_verify_both_hashes_match(self):
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert verify_password("same_password", h1) is True
        assert verify_password("same_password", h2) is True


class TestTokenCreation:
    def test_create_access_token_returns_string(self):
        import uuid
        token = create_access_token(uuid.uuid4())
        assert isinstance(token, str)
        assert len(token) > 20

    def test_create_access_token_decodable(self):
        import uuid
        import jwt
        from app.config import get_settings
        settings = get_settings()
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["sub"] == str(user_id)
        assert "exp" in payload
        assert "iat" in payload

    def test_token_has_expiry(self):
        import uuid
        import jwt
        from app.config import get_settings
        settings = get_settings()
        token = create_access_token(uuid.uuid4())
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        assert payload["exp"] > payload["iat"]