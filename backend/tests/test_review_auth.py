import io
from types import SimpleNamespace
from urllib.error import HTTPError

import pytest
from fastapi import HTTPException

from app import review_auth


def test_review_capture_validates_supabase_access_token(monkeypatch) -> None:
    monkeypatch.setattr(review_auth, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_anon_key="public-test-key",
    ))
    requests = []

    def fake_urlopen(request, timeout):
        requests.append((request, timeout))
        return io.BytesIO(b'{"id":"owner-123"}')

    monkeypatch.setattr(review_auth, "urlopen", fake_urlopen)
    assert review_auth.get_review_user("Bearer valid-test-token") == "owner-123"
    request, timeout = requests[0]
    assert request.full_url == "https://example.supabase.co/auth/v1/user"
    assert request.get_header("Authorization") == "Bearer valid-test-token"
    assert timeout == 10


def test_review_capture_rejects_invalid_access_token(monkeypatch) -> None:
    monkeypatch.setattr(review_auth, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_anon_key="public-test-key",
    ))
    monkeypatch.setattr(review_auth, "urlopen", lambda request, timeout: (_ for _ in ()).throw(
        HTTPError(request.full_url, 401, "unauthorized", {}, None),
    ))
    with pytest.raises(HTTPException) as error:
        review_auth.get_review_user("Bearer invalid-test-token")
    assert error.value.status_code == 401
