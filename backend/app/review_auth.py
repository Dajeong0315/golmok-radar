"""Validate an Auth access token before allowing a bounded review capture."""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Header, HTTPException

from .config import get_settings


def get_review_user(authorization: str | None = Header(default=None)) -> str:
    settings = get_settings()
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "카카오 로그인 후 리뷰 분석을 시작해 주세요.")
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "로그인 검증 설정이 준비되지 않았습니다.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "카카오 로그인 세션을 확인할 수 없습니다.")
    request = Request(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
        headers={"apikey": settings.supabase_anon_key, "Authorization": f"Bearer {token}"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.load(response)
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        raise HTTPException(401, "카카오 로그인 세션을 확인할 수 없습니다.") from error
    user_id = payload.get("id") if isinstance(payload, dict) else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(401, "카카오 로그인 세션을 확인할 수 없습니다.")
    return user_id
