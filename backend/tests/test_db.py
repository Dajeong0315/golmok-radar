from app.db import normalize_database_url


def test_normalize_supabase_postgres_url_for_psycopg3() -> None:
    assert normalize_database_url("postgresql://user:secret@example.com/db") == (
        "postgresql+psycopg://user:secret@example.com/db"
    )
    assert normalize_database_url("postgres://user:secret@example.com/db") == (
        "postgresql+psycopg://user:secret@example.com/db"
    )


def test_normalize_keeps_explicit_driver_and_sqlite_urls() -> None:
    assert normalize_database_url("postgresql+psycopg://user:secret@example.com/db") == (
        "postgresql+psycopg://user:secret@example.com/db"
    )
    assert normalize_database_url("sqlite:///data/test.db") == "sqlite:///data/test.db"
