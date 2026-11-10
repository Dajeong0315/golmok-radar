from pathlib import Path
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet
from playwright.sync_api import Error as PlaywrightError

from app import env_check
from app.config import Settings, get_settings
from app.review_capture import CaptureConfigurationError, CaptureTarget, PublicReviewBrowserCollector

SECRET_VALUES = {
    "supabase_anon_key": "anon-secret-value-123",
    "supabase_secret_key": "service-secret-value-456",
    "kakao_admin_key": "kakao-admin-secret-789",
    "kakao_rest_api_key": "kakao-rest-secret-000",
}


def ready_settings(tmp_path: Path, **overrides) -> Settings:
    values = {
        "database_url": f"sqlite:///{(tmp_path / 'ops.db').as_posix()}",
        "cors_origins": ["https://golmok-radar.axworks.site"],
        "supabase_url": "https://example.supabase.co",
        "review_capture_encryption_key": Fernet.generate_key().decode(),
        "k_startup_api_key": None,
        **SECRET_VALUES,
    }
    values.update(overrides)
    return Settings.model_construct(**values)


def by_item(checks):
    return {check.item: check for check in checks}


def test_ready_server_settings_pass_and_never_print_secret_values(tmp_path: Path) -> None:
    checks = by_item(env_check.check_settings(ready_settings(tmp_path)))
    assert all(check.ok for check in checks.values() if check.required)
    assert checks["K_STARTUP_API_KEY"].required is False
    text = repr(list(checks.values()))
    for secret in SECRET_VALUES.values():
        assert secret not in text


@pytest.mark.parametrize(("override", "item", "detail"), [
    ({"cors_origins": ["https://golmok-radar.axworks.site/"]}, "CORS_ORIGINS", "끝에 '/'"),
    ({"cors_origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}, "CORS_ORIGINS", "로컬 주소만"),
    ({"review_capture_encryption_key": "not-a-fernet-key"}, "REVIEW_CAPTURE_ENCRYPTION_KEY", "형식"),
    ({"kakao_rest_api_key": ""}, "KAKAO_REST_API_KEY", "없음"),
    ({"supabase_secret_key": None, "supabase_service_role_key": None}, "SUPABASE_SECRET_KEY 또는 SUPABASE_SERVICE_ROLE_KEY", "없음"),
])
def test_missing_or_wrong_settings_are_reported(tmp_path: Path, override, item, detail) -> None:
    check = by_item(env_check.check_settings(ready_settings(tmp_path, **override)))[item]
    assert check.ok is False and detail in check.detail


def test_database_check_reports_loaded_quarters(tmp_path: Path) -> None:
    from sqlalchemy.orm import Session

    from app.db import Base, make_engine
    from app.models import StoreMetric, TradeArea

    settings = ready_settings(tmp_path)
    assert env_check.check_database(settings).ok is False  # 표가 없으면 실패로 보고
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(TradeArea(code="1", name="상권", district_code="1", district_name="성동구", area_type_code="A",
                              area_type_name="골목상권", x_epsg5181=0, y_epsg5181=0, longitude=127, latitude=37.5))
        session.add(StoreMetric(quarter_code="20262", trade_area_code="1", industry_code="CS100010", industry_name="커피-음료", store_count=1))
    check = env_check.check_database(settings)
    assert check.ok and "20262 1행" in check.detail


def test_review_storage_check(tmp_path: Path) -> None:
    checks = by_item(env_check.check_review_storage(tmp_path / "reviews"))
    assert checks["리뷰 보관 폴더 쓰기"].ok
    assert "GB 남음" in checks["디스크 여유"].detail


def test_missing_capture_browser_becomes_configuration_error(monkeypatch) -> None:
    def launch(**_kwargs):
        raise PlaywrightError("Executable doesn't exist at /home/ubuntu/.cache/ms-playwright/chromium")

    class Context:
        def __enter__(self):
            return SimpleNamespace(chromium=SimpleNamespace(launch=launch))

        def __exit__(self, *_args):
            return None

    monkeypatch.setattr("playwright.sync_api.sync_playwright", lambda: Context())
    collector = PublicReviewBrowserCollector(Fernet.generate_key().decode())
    with pytest.raises(CaptureConfigurationError, match="browser is not available"):
        collector.capture_with_failures([CaptureTarget("kakao", "https://place.map.kakao.com/1", "A")])


def test_configured_browser_path_is_used_only_when_the_file_exists(monkeypatch, tmp_path: Path) -> None:
    browser = tmp_path / "chromium"
    browser.write_text("", encoding="utf-8")
    monkeypatch.setattr(get_settings(), "review_capture_browser_path", str(browser))
    assert PublicReviewBrowserCollector(Fernet.generate_key().decode())._executable_path == str(browser)
    # .env.example의 설명 문장이 값으로 남아 있어도 경로로 쓰지 않습니다.
    monkeypatch.setattr(get_settings(), "review_capture_browser_path", "Optional absolute Chrome or Edge executable path for the private collector.")
    collector = PublicReviewBrowserCollector(Fernet.generate_key().decode())
    assert collector._executable_path in (None, *(path for path in (
        r"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    ) if Path(path).is_file()))
