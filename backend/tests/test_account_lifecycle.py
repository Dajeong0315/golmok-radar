from datetime import datetime, timedelta, timezone
from base64 import urlsafe_b64encode
from io import BytesIO
import json
from types import SimpleNamespace
from urllib.error import HTTPError

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import account_lifecycle as lifecycle
from app.db import get_db
from app.main import app


USER_A = "11111111-1111-4111-8111-111111111111"
USER_B = "22222222-2222-4222-8222-222222222222"


def account(user_id=USER_A):
    return {
        "id": user_id,
        "last_sign_in_at": datetime.now(timezone.utc).isoformat(),
        "identities": [{"provider": "kakao", "provider_id": "123456789"}],
    }


def test_recent_auth_uses_supabase_user_response(monkeypatch):
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(supabase_url="https://example.supabase.co", supabase_anon_key="public"))
    monkeypatch.setattr(lifecycle, "_request_json", lambda request: account())
    monkeypatch.setattr(lifecycle, "ensure_recent_session", lambda session, token, user_id: None)
    assert lifecycle.verified_account("Bearer token", object())["id"] == USER_A
    with pytest.raises(HTTPException) as missing:
        lifecycle.verified_account(None, object())
    assert missing.value.status_code == 401


def test_recent_session_requires_same_user_and_fresh_auth_session():
    claims = {"sub": USER_A, "session_id": "33333333-3333-4333-8333-333333333333"}
    token = "header." + urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=") + ".signature"

    class SessionStub:
        created_at = datetime.now(timezone.utc)

        def execute(self, query, params):
            assert params == {"session_id": claims["session_id"], "user_id": USER_A}
            return SimpleNamespace(scalar_one_or_none=lambda: self.created_at)

    session = SessionStub()
    lifecycle.ensure_recent_session(session, token, USER_A)
    session.created_at -= timedelta(minutes=11)
    with pytest.raises(HTTPException) as stale:
        lifecycle.ensure_recent_session(session, token, USER_A)
    assert stale.value.status_code == 403
    assert stale.value.detail["stage"] == "reauthentication"
    with pytest.raises(HTTPException) as wrong_user:
        lifecycle.ensure_recent_session(session, token, USER_B)
    assert wrong_user.value.status_code == 401


def test_delete_all_records_is_scoped_to_authenticated_owner():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.begin() as connection:
        for table in lifecycle.ACCOUNT_TABLES:
            connection.execute(text(f"CREATE TABLE {table} (user_id TEXT, value TEXT)"))
            connection.execute(text(f"INSERT INTO {table} VALUES (:owner, 'keep')"), {"owner": USER_B})
            connection.execute(text(f"INSERT INTO {table} VALUES (:owner, 'delete')"), {"owner": USER_A})

    def db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[lifecycle.verified_account] = lambda: account()
    app.dependency_overrides[get_db] = db
    try:
        with TestClient(app) as client:
            result = client.delete("/api/v1/account/records")
        assert result.status_code == 200
        assert result.json() == {"status": "deleted", "scope": "records"}
        with engine.connect() as connection:
            for table in lifecycle.ACCOUNT_TABLES:
                assert connection.execute(text(f"SELECT user_id FROM {table}")).scalars().all() == [USER_B]
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_account_delete_preflight_allows_local_frontend():
    with TestClient(app) as client:
        response = client.options("/api/v1/account/records", headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "authorization",
        })
    assert response.status_code == 200
    assert "DELETE" in response.headers["access-control-allow-methods"]


def test_withdrawal_reports_partial_failure_and_retries(monkeypatch):
    calls = []
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_secret_key=None, supabase_service_role_key="private", kakao_admin_key="private"
    ))
    monkeypatch.setattr(lifecycle, "delete_records", lambda session, user_id: calls.append(("records", user_id)))
    monkeypatch.setattr(lifecycle, "verify_supabase_admin", lambda user_id, url, key: calls.append(("preflight", user_id)))
    monkeypatch.setattr(lifecycle, "unlink_kakao", lambda provider_id, key: calls.append(("kakao", provider_id)))

    def failed_delete(user_id, url, key):
        calls.append(("supabase", user_id))
        raise HTTPException(502, {"stage": "supabase_delete"})

    monkeypatch.setattr(lifecycle, "delete_supabase_user", failed_delete)
    with pytest.raises(HTTPException) as error:
        lifecycle.withdraw_membership(account(), object())
    assert error.value.detail["stage"] == "supabase_delete"
    assert calls == [("preflight", USER_A), ("records", USER_A), ("kakao", "123456789"), ("supabase", USER_A)]


def test_withdrawal_requires_server_keys_and_correct_kakao_identity(monkeypatch):
    calls = []
    monkeypatch.setattr(lifecycle, "delete_records", lambda session, user_id: calls.append(user_id))
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_secret_key=None, supabase_service_role_key=None, kakao_admin_key=None
    ))
    with pytest.raises(HTTPException) as unconfigured:
        lifecycle.withdraw_membership(account(), object())
    assert unconfigured.value.status_code == 503
    assert calls == []
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_secret_key=None, supabase_service_role_key="private", kakao_admin_key="private"
    ))
    with pytest.raises(HTTPException) as missing_identity:
        lifecycle.withdraw_membership({**account(), "identities": [{"provider": "google", "provider_id": "123"}]}, object())
    assert missing_identity.value.status_code == 409
    assert calls == []


def test_kakao_identity_accepts_supabase_auth_response_shape():
    real_shape = {**account(), "identities": [{
        "provider": "kakao", "id": "123456789",
        "identity_id": "33333333-3333-4333-8333-333333333333",
        "identity_data": {"provider_id": "123456789", "sub": "123456789"},
    }]}
    assert lifecycle.kakao_provider_id(real_shape) == "123456789"
    real_shape["identities"][0]["identity_data"]["sub"] = "987654321"
    with pytest.raises(HTTPException) as mismatched:
        lifecycle.kakao_provider_id(real_shape)
    assert mismatched.value.detail["stage"] == "identity"

def test_withdrawal_completes_all_stages(monkeypatch):
    calls = []
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_secret_key=None, supabase_service_role_key="private", kakao_admin_key="private"
    ))
    monkeypatch.setattr(lifecycle, "delete_records", lambda session, user_id: calls.append("records"))
    monkeypatch.setattr(lifecycle, "verify_supabase_admin", lambda user_id, url, key: calls.append("preflight"))
    monkeypatch.setattr(lifecycle, "unlink_kakao", lambda provider_id, key: calls.append("kakao"))
    monkeypatch.setattr(lifecycle, "delete_supabase_user", lambda user_id, url, key: calls.append("supabase"))
    assert lifecycle.withdraw_membership(account(), object()) == {"status": "deleted", "scope": "membership", "kakao_unlinked": True}
    assert calls == ["preflight", "records", "kakao", "supabase"]


def test_withdrawal_stops_before_deletion_when_admin_key_is_invalid(monkeypatch):
    calls = []
    monkeypatch.setattr(lifecycle, "get_settings", lambda: SimpleNamespace(
        supabase_url="https://example.supabase.co", supabase_secret_key="sb_publishable_wrong", supabase_service_role_key=None, kakao_admin_key="private"
    ))
    monkeypatch.setattr(lifecycle, "delete_records", lambda session, user_id: calls.append("records"))
    monkeypatch.setattr(lifecycle, "unlink_kakao", lambda provider_id, key: calls.append("kakao"))
    monkeypatch.setattr(lifecycle, "verify_supabase_admin", lambda user_id, url, key: (_ for _ in ()).throw(HTTPException(503, {"stage": "configuration"})))
    with pytest.raises(HTTPException) as invalid:
        lifecycle.withdraw_membership(account(), object())
    assert invalid.value.status_code == 503
    assert calls == []


def test_kakao_unlink_accepts_only_already_unlinked_retry(monkeypatch):
    def response(request):
        raise HTTPError(request.full_url, 400, "bad request", {}, BytesIO(json.dumps({"code": -101}).encode()))

    monkeypatch.setattr(lifecycle, "_request_json", response)
    lifecycle.unlink_kakao("123456789", "private")
    monkeypatch.setattr(lifecycle, "_request_json", lambda request: {"id": 987})
    with pytest.raises(HTTPException) as error:
        lifecycle.unlink_kakao("123456789", "private")
    assert error.value.detail["stage"] == "kakao_unlink"


def test_supabase_secret_key_uses_apikey_header_without_bearer(monkeypatch):
    seen = []
    monkeypatch.setattr(lifecycle, "_request_json", lambda request: seen.append(request.header_items()) or {})
    lifecycle.delete_supabase_user(USER_A, "https://example.supabase.co", "sb_secret_example")
    assert dict(seen[0])["Apikey"] == "sb_secret_example"
    assert "Authorization" not in dict(seen[0])
    lifecycle.delete_supabase_user(USER_A, "https://example.supabase.co", "legacy-jwt")
    assert dict(seen[1])["Authorization"] == "Bearer legacy-jwt"


def test_publishable_key_is_rejected_before_any_admin_call(monkeypatch):
    monkeypatch.setattr(lifecycle, "_request_json", lambda request: pytest.fail("Admin API must not be called"))
    with pytest.raises(HTTPException) as invalid:
        lifecycle.verify_supabase_admin(USER_A, "https://example.supabase.co", "sb_publishable_wrong")
    assert invalid.value.status_code == 503
