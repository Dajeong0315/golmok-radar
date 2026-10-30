r"""R-ONE 소규모상가 임대 벤치마크 원문 JSON을 내려받는다.

실행 (프로젝트 루트):
    py database\scripts\fetch_rone.py
    py database\scripts\fetch_rone.py --check

인증키는 backend/.env의 RONE_API_KEY에서 읽고 출력하거나 파일에 저장하지 않는다.
응답 원문은 수정하지 않고 database/raw/rone/에 보관한다.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app.rone import RONE_API_BASE_URL, RONE_TABLES, response_rows  # noqa: E402


ENV_FILE = BACKEND / ".env"
OUT_DIR = ROOT / "database" / "raw" / "rone"


def read_key() -> str:
    if not ENV_FILE.exists():
        sys.exit(f"[오류] {ENV_FILE} 파일이 없습니다.")
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        if line.strip().startswith("RONE_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key
    sys.exit("[오류] backend/.env에 RONE_API_KEY=... 값이 필요합니다.")


def fetch(key: str, table_id: str) -> bytes:
    params = urllib.parse.urlencode({
        "Type": "json",
        "pIndex": 1,
        "pSize": 1000,
        "DTACYCLE_CD": "QY",
        "STATBL_ID": table_id,
        "KEY": key,
    })
    try:
        with urllib.request.urlopen(f"{RONE_API_BASE_URL}?{params}", timeout=30) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        sys.exit(f"[오류] R-ONE 서버가 HTTP {error.code}를 반환했습니다.")
    except urllib.error.URLError as error:
        sys.exit(f"[오류] R-ONE 서버에 연결하지 못했습니다: {error.reason}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="응답 계약만 확인하고 저장하지 않음")
    args = parser.parse_args()

    key = read_key()
    fetched_at = datetime.now()
    collected: list[dict[str, object]] = []
    for spec in RONE_TABLES:
        raw = fetch(key, spec.table_id)
        try:
            payload = json.loads(raw.decode("utf-8"))
            rows = response_rows(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            sys.exit(f"[오류] {spec.metric_label} 응답을 검증하지 못했습니다: {error}")
        periods = sorted({str(row.get("WRTTIME_DESC")) for row in rows})
        units = sorted({str(row.get("UI_NM")) for row in rows})
        print(f"연결 성공: {spec.metric_label}, {len(rows):,}건, {', '.join(periods)}, 단위 {', '.join(units)}")
        filename = f"rone_{spec.metric_key}_{spec.table_id}_{fetched_at:%Y%m%d}.json"
        collected.append({
            "metric_key": spec.metric_key,
            "table_id": spec.table_id,
            "file": filename,
            "rows": len(rows),
            "periods": periods,
            "units": units,
            "raw": raw,
        })

    if args.check:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for item in collected:
        (OUT_DIR / str(item["file"])).write_bytes(item.pop("raw"))
    meta = {
        "dataset": "한국부동산원 상업용부동산 임대동향조사",
        "provider": "한국부동산원 R-ONE Open API",
        "fetched_at": fetched_at.isoformat(timespec="seconds"),
        "cycle": "quarterly",
        "building_type": "small_retail",
        "files": collected,
    }
    meta_path = OUT_DIR / f"rone_small_retail_{fetched_at:%Y%m%d}.meta.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {meta_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
