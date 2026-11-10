"""서버 설정 점검 (Phase 46). 비밀값은 출력하지 않고 기능별 준비 여부만 보여 줍니다.

실행 (backend 폴더에서):
    .venv/bin/python -m app.env_check            # 설정·DB·리뷰 보관 폴더 점검
    .venv/bin/python -m app.env_check --browser  # 리뷰 수집 브라우저 실행까지 점검 (수 초 걸림)

모든 필수 항목이 준비되면 종료 코드 0, 하나라도 빠지면 1을 돌려줍니다.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

from .config import DEFAULT_SQLITE_URL, Settings, get_settings

REVIEW_DIR = Path(__file__).resolve().parents[2] / "database" / "raw" / "reviews"
MIN_FREE_BYTES = 1024 ** 3  # 리뷰 암호화 보관·로그용으로 최소 1GB 여유


@dataclass(frozen=True)
class Check:
    feature: str
    item: str
    ok: bool
    detail: str
    required: bool = True


def present(value: str | None) -> bool:
    return bool(value and value.strip())


def check_settings(settings: Settings) -> list[Check]:
    checks: list[Check] = []
    db_is_default = settings.database_url == DEFAULT_SQLITE_URL
    checks.append(Check("기본", "DATABASE_URL", not db_is_default,
                        "운영 DB 주소가 설정됨" if not db_is_default else "설정 없음: 서버 안 로컬 SQLite를 쓰게 됨"))
    origins = settings.cors_origins
    bad = [origin for origin in origins if origin.endswith("/")]
    local_only = all("localhost" in origin or "127.0.0.1" in origin for origin in origins)
    checks.append(Check("기본", "CORS_ORIGINS", bool(origins) and not bad and not local_only,
                        f"{len(origins)}개 허용: {', '.join(origins)}" + (f" / 끝에 '/'가 있음: {', '.join(bad)}" if bad else "")
                        + (" / 로컬 주소만 있음" if local_only else "")))
    checks.append(Check("로그인·내 기록", "SUPABASE_URL", present(settings.supabase_url), "있음" if present(settings.supabase_url) else "없음"))
    checks.append(Check("로그인·내 기록", "SUPABASE_ANON_KEY", present(settings.supabase_anon_key), "있음" if present(settings.supabase_anon_key) else "없음"))
    service = present(settings.supabase_secret_key) or present(settings.supabase_service_role_key)
    checks.append(Check("회원 탈퇴", "SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY", service, "있음" if service else "없음"))
    checks.append(Check("회원 탈퇴", "KAKAO_ADMIN_KEY", present(settings.kakao_admin_key), "있음" if present(settings.kakao_admin_key) else "없음"))
    checks.append(Check("리뷰 비교", "KAKAO_REST_API_KEY", present(settings.kakao_rest_api_key), "있음" if present(settings.kakao_rest_api_key) else "없음"))
    checks.append(Check("리뷰 비교", "REVIEW_CAPTURE_ENCRYPTION_KEY", *fernet_status(settings.review_capture_encryption_key)))
    checks.append(Check("공식 지원 정보", "K_STARTUP_API_KEY", present(settings.k_startup_api_key),
                        "있음" if present(settings.k_startup_api_key) else "없음", required=False))
    return checks


def fernet_status(key: str | None) -> tuple[bool, str]:
    if not present(key):
        return False, "없음"
    try:
        from cryptography.fernet import Fernet

        Fernet(key.strip().encode("utf-8"))
    except (TypeError, ValueError):
        return False, "형식이 올바르지 않음 (Fernet 키가 아님)"
    return True, "올바른 형식"


def check_database(settings: Settings) -> Check:
    try:
        from sqlalchemy import text

        from .db import make_engine

        engine = make_engine(settings.database_url)
        with engine.connect() as connection:
            quarters = connection.execute(text("SELECT quarter_code, count(*) FROM store_metrics GROUP BY quarter_code ORDER BY quarter_code DESC")).all()
        engine.dispose()
    except Exception as error:  # noqa: BLE001 - 어떤 연결 오류든 점검 결과로 보여 줍니다.
        return Check("기본", "DB 연결", False, f"연결 실패: {type(error).__name__}")
    summary = ", ".join(f"{code} {count:,}행" for code, count in quarters) or "점포 데이터 없음"
    return Check("기본", "DB 연결", bool(quarters), summary)


def check_review_storage(directory: Path = REVIEW_DIR) -> list[Check]:
    try:
        directory.mkdir(parents=True, exist_ok=True)
        probe = directory / ".write-check"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        writable = True
    except OSError:
        writable = False
    free = shutil.disk_usage(directory if directory.exists() else directory.parent).free
    files = len(list(directory.glob("*.json"))) if directory.exists() else 0
    return [
        Check("리뷰 비교", "리뷰 보관 폴더 쓰기", writable, f"{directory} (보관 파일 {files}개)"),
        Check("리뷰 비교", "디스크 여유", free >= MIN_FREE_BYTES, f"{free / 1024 ** 3:.1f}GB 남음"),
    ]


def check_browser(settings: Settings) -> Check:
    try:
        from playwright.sync_api import Error as PlaywrightError, sync_playwright
    except ImportError:
        return Check("리뷰 비교", "수집 브라우저", False, "playwright 패키지 없음: pip install -r requirements.txt")
    raw = (settings.review_capture_browser_path or "").strip()
    path = raw if raw and Path(raw).is_file() else None
    ignored = f" / REVIEW_CAPTURE_BROWSER_PATH가 실제 파일이 아니라 무시함" if raw and not path else ""
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, executable_path=path)
            version = browser.version
            browser.close()
    except PlaywrightError as error:
        first_line = str(error).strip().splitlines()[0] if str(error).strip() else type(error).__name__
        return Check("리뷰 비교", "수집 브라우저", False, f"실행 실패: {first_line[:160]}{ignored}")
    return Check("리뷰 비교", "수집 브라우저", True, f"Chromium {version}" + (f" ({path})" if path else " (Playwright 기본 설치)") + ignored)


def run(include_browser: bool, settings: Settings | None = None) -> list[Check]:
    settings = settings or get_settings()
    checks = check_settings(settings)
    checks.insert(1, check_database(settings))
    checks.extend(check_review_storage())
    if include_browser:
        checks.append(check_browser(settings))
    return checks


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="서버 설정 점검 (비밀값은 출력하지 않음)")
    parser.add_argument("--browser", action="store_true", help="리뷰 수집 브라우저 실행까지 점검")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    checks = run(args.browser)
    if args.json:
        print(json.dumps([check.__dict__ for check in checks], ensure_ascii=False, indent=2))
    else:
        groups: dict[str, list[Check]] = {}
        for check in checks:
            groups.setdefault(check.feature, []).append(check)
        for feature, items in groups.items():
            print(f"\n[{feature}]")
            for check in items:
                mark = "OK" if check.ok else ("--" if not check.required else "XX")
                print(f"  {mark} {check.item}: {check.detail}")
        missing = [check for check in checks if check.required and not check.ok]
        print("\n결과: " + ("모두 준비됨" if not missing else f"준비 안 된 필수 항목 {len(missing)}개"))
    return 0 if all(check.ok for check in checks if check.required) else 1


if __name__ == "__main__":
    sys.exit(main())
