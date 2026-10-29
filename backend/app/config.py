from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_URL = f"sqlite:///{(BACKEND_DIR / 'data' / 'golmok.db').as_posix()}"


class Settings(BaseSettings):
    database_url: str = DEFAULT_SQLITE_URL
    app_name: str = "골목 레이더 API"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    k_startup_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

