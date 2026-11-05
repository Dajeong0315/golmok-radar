"""Owner verified account data deletion and Kakao account withdrawal."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from base64 import urlsafe_b64decode
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db


router = APIRouter(prefix="/api/v1/account", tags=["account"])
REAUTH_WINDOW = timedelta(minutes=10)
ACCOUNT_TABLES = ("user_records", "property_worksheets", "user_favorites")


def _request_json(request: Request) -> dict:
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read()
    except (HTTPError, URLError, TimeoutError) as error:
        raise error
    if not body:
        return {}
    payload = json.loads(body)
    if not isinstance(payload, dict):
        raise ValueError("Unexpected response")
    return payload


def ensure_recent_session(session: Session, token: str, user_id: str) -> None:
    try:
        encoded = token.split(".")[1]
        claims = json.loads(urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
        if not isinstance(claims, dict):
            raise ValueError("Invalid claims")
        session_id = str(UUID(str(claims["session_id"])))
        if claims.get("sub") != user_id:
            raise ValueError("User mismatch")
    except (IndexError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(401, {"stage": "authentication", "message": "로그인 상태를 확인할 수 없습니다."}) from error
    created_at = session.execute(
        text("SELECT created_at FROM auth.sessions WHERE id = :session_id AND user_id = :user_id"),
        {"session_id": session_id, "user_id": user_id},
    ).scalar_one_or_none()
    if not isinstance(created_at, datetime):
        raise HTTPException(403, {"stage": "reauthentication", "message": "카카오로 다시 로그인한 뒤 시도해 주세요."})
    age = datetime.now(timezone.utc) - created_at.astimezone(timezone.utc)
    if age < timedelta(0) or age > REAUTH_WINDOW:
        raise HTTPException(403, {"stage": "reauthentication", "message": "카카오로 다시 로그인한 뒤 시도해 주세요."})


def verified_account(authorization: str | None = Header(default=None), session: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, {"stage": "configuration", "message": "계정 확인 설정이 준비되지 않았습니다."})
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, {"stage": "authentication", "message": "다시 로그인해 주세요."})
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, {"stage": "authentication", "message": "다시 로그인해 주세요."})
    request = Request(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
        headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
    )
    try:
        account = _request_json(request)
        UUID(str(account.get("id", "")))
    except (HTTPError, URLError, TimeoutError, ValueError, TypeError) as error:
        raise HTTPException(401, {"stage": "authentication", "message": "로그인 상태를 확인할 수 없습니다."}) from error
    ensure_recent_session(session, token, account["id"])
    return account


def delete_records(session: Session, user_id: str) -> None:
    try:
        for table in ACCOUNT_TABLES:
            session.execute(text(f"DELETE FROM {table} WHERE user_id = :user_id"), {"user_id": user_id})
        session.commit()
    except Exception:
        session.rollback()
        raise


def kakao_provider_id(account: dict) -> str:
    identities = account.get("identities")
    if not isinstance(identities, list):
        raise HTTPException(409, {"stage": "identity", "message": "카카오 연결 정보를 확인할 수 없습니다."})
    kakao = [identity for identity in identities if isinstance(identity, dict) and identity.get("provider") == "kakao"]
    if len(kakao) != 1:
        raise HTTPException(409, {"stage": "identity", "message": "카카오 연결 정보를 확인할 수 없습니다."})
    identity = kakao[0]
    data = identity.get("identity_data") if isinstance(identity.get("identity_data"), dict) else {}
    candidates = [str(value) for value in (
        identity.get("provider_id"), data.get("provider_id"), data.get("sub"), identity.get("id"),
    ) if value is not None and str(value).isdecimal()]
    if not candidates or len(set(candidates)) != 1:
        raise HTTPException(409, {"stage": "identity", "message": "카카오 연결 정보를 확인할 수 없습니다."})
    return candidates[0]


def unlink_kakao(provider_id: str, admin_key: str) -> None:
    request = Request(
        "https://kapi.kakao.com/v1/user/unlink",
        data=urlencode({"target_id_type": "user_id", "target_id": provider_id}).encode(),
        headers={"Authorization": f"KakaoAK {admin_key}", "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"},
        method="POST",
    )
    try:
        result = _request_json(request)
    except HTTPError as error:
        try:
            response = json.load(error)
        except (ValueError, OSError):
            response = {}
        # A retry after a completed unlink can return "user not linked".
        if error.code == 400 and response.get("code") == -101:
            return
        raise HTTPException(502, {"stage": "kakao_unlink", "message": "카카오 연결 해제에 실패했습니다. 다시 시도해 주세요."}) from error
    except (URLError, TimeoutError, ValueError) as error:
        raise HTTPException(502, {"stage": "kakao_unlink", "message": "카카오 연결 해제에 실패했습니다. 다시 시도해 주세요."}) from error
    if str(result.get("id", "")) != provider_id:
        raise HTTPException(502, {"stage": "kakao_unlink", "message": "카카오 연결 해제 결과를 확인할 수 없습니다."})


def delete_supabase_user(user_id: str, url: str, service_key: str) -> None:
    headers = _admin_headers(service_key)
    request = Request(
        f"{url.rstrip('/')}/auth/v1/admin/users/{user_id}",
        headers=headers,
        method="DELETE",
    )
    try:
        _request_json(request)
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise HTTPException(502, {"stage": "supabase_delete", "message": "카카오 연결은 해제됐지만 서비스 계정 삭제를 완료하지 못했습니다. 다시 시도해 주세요."}) from error


def _admin_headers(service_key: str) -> dict[str, str]:
    headers = {"apikey": service_key}
    if not service_key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {service_key}"
    return headers


def verify_supabase_admin(user_id: str, url: str, service_key: str) -> None:
    # Validate the elevated key before any record deletion or Kakao unlink.
    if service_key.startswith("sb_publishable_"):
        raise HTTPException(503, {"stage": "configuration", "message": "Supabase Secret key가 아닌 Publishable key가 설정돼 탈퇴를 시작하지 않았습니다."})
    request = Request(
        f"{url.rstrip('/')}/auth/v1/admin/users/{user_id}",
        headers=_admin_headers(service_key),
    )
    try:
        payload = _request_json(request)
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise HTTPException(503, {"stage": "configuration", "message": "Supabase 관리자 키를 확인할 수 없어 탈퇴를 시작하지 않았습니다."}) from error
    if payload.get("id") != user_id:
        raise HTTPException(503, {"stage": "configuration", "message": "Supabase 관리자 계정 확인에 실패해 탈퇴를 시작하지 않았습니다."})


@router.delete("/records")
def delete_all_records(account: dict = Depends(verified_account), session: Session = Depends(get_db)) -> dict:
    try:
        delete_records(session, account["id"])
    except Exception as error:
        raise HTTPException(500, {"stage": "records", "message": "기록 삭제에 실패했습니다. 다시 시도해 주세요."}) from error
    return {"status": "deleted", "scope": "records"}


@router.delete("/membership")
def withdraw_membership(account: dict = Depends(verified_account), session: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    service_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not service_key or not settings.kakao_admin_key:
        raise HTTPException(503, {"stage": "configuration", "message": "회원 탈퇴 설정이 준비되지 않았습니다."})
    provider_id = kakao_provider_id(account)
    verify_supabase_admin(account["id"], settings.supabase_url or "", service_key)
    try:
        delete_records(session, account["id"])
    except Exception as error:
        raise HTTPException(500, {"stage": "records", "message": "기록 삭제에 실패했습니다. 다시 시도해 주세요."}) from error
    unlink_kakao(provider_id, settings.kakao_admin_key)
    delete_supabase_user(account["id"], settings.supabase_url or "", service_key)
    return {"status": "deleted", "scope": "membership", "kakao_unlinked": True}
