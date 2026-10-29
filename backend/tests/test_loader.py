from pathlib import Path

import pytest


RAW_STORE = Path(__file__).resolve().parents[2] / "database" / "raw" / "store"
pytestmark = pytest.mark.skipif(
    not any(RAW_STORE.glob("*.zip")),
    reason="Git에서 제외한 원천 파일이 있을 때만 적재 통합 테스트를 실행합니다.",
)


def test_loader_imports_expected_counts(tmp_path: Path) -> None:
    from database.scripts.load_data import load

    counts = load(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")

    assert counts == {
        "trade_areas": 117,
        "store_metrics": 110,
        "sales_metrics": 82,
        "population_metrics": 117,
        "data_sources": 4,
    }

