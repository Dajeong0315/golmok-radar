from functools import lru_cache
import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SQLITE_URL = f"sqlite:///{(BACKEND_DIR / 'data' / 'golmok.db').as_posix()}"
ENVIRONMENT = os.getenv("GOLMOK_ENV", "development")
ENV_FILE = BACKEND_DIR / (".env.test" if ENVIRONMENT == "test" else ".env")


class Settings(BaseSettings):
    database_url: str = DEFAULT_SQLITE_URL
    app_name: str = "골목 레이더 API"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    rone_api_key: str | None = None
    k_startup_api_key: str | None = None

    model_config = SettingsConfigDict(
        env_file=(ENV_FILE,),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

