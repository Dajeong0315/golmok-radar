"""서울 열린데이터광장 Open API에서 한 기준분기의 점포·추정매출 원천을 내려받는다 (Phase 40).

연도별 ZIP이 아직 올라오지 않은 분기(예: 2026년 1·2분기)를 받을 때 쓴다.

실행 (프로젝트 폴더에서):
    py database\\scripts\\fetch_quarter.py --quarter 20262
    py database\\scripts\\fetch_quarter.py --quarter 20262 --check   # 1건만 받아 연결·컬럼 확인

- 인증키는 backend/.env 의 SEOUL_OPEN_API_KEY 에서 읽고, 화면·파일 어디에도 출력하지 않는다.
- 받은 행은 가공하지 않고 database/raw/store/, database/raw/sales/ 에 CSV(UTF-8)로 저장한다.
- 같은 이름의 .meta.json 에 서비스명·기준분기·수집 시각·보고/저장 행 수를 남긴다.
- 보고 행 수와 저장 행 수가 다르면 파일을 저장하지 않고 실패로 끝낸다.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database.scripts.raw_sources import DATASET_NAMES, api_csv_path  # noqa: E402

RAW = ROOT / "database" / "raw"
PAGE_SIZE = 1000  # 열린데이터광장은 한 번에 최대 1,000건

DATASETS = {
    "store": {
        "service": "VwsmTrdarStorQq",
        "dataset": DATASET_NAMES["store"],
        "dataset_id": "OA-15577",
    },
    "sales": {
        "service": "VwsmTrdarSelngQq",
        "dataset": DATASET_NAMES["sales"],
        "dataset_id": "OA-15572",
    },
}
PROVIDER = "서울신용보증재단 / 서울 열린데이터광장 Open API"


def read_key() -> str:
    env_file = ROOT / "backend" / ".env"
    if not env_file.exists():
        sys.exit(f"[오류] {env_file} 파일이 없어요.")
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        if line.strip().startswith("SEOUL_OPEN_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key
    sys.exit("[오류] backend/.env 에 SEOUL_OPEN_API_KEY=... 줄이 없거나 값이 비어 있어요.")


def http_call(key: str, service: str, start: int, end: int, quarter: str) -> dict:
    url = f"http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{end}/{quarter}"
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"서버가 HTTP {error.code}를 돌려줬어요.") from None
    except urllib.error.URLError as error:
        raise RuntimeError(f"서버에 연결하지 못했어요: {error.reason}") from None
    except json.JSONDecodeError:
        raise RuntimeError("응답이 JSON이 아니에요. 서비스명을 확인해 주세요.") from None


def body_of(data: dict, service: str) -> dict:
    if service in data:
        result = data[service].get("RESULT", {})
        if result.get("CODE") not in (None, "INFO-000"):
            raise RuntimeError(f"API 응답 코드 {result.get('CODE')}: {result.get('MESSAGE')}")
        return data[service]
    result = data.get("RESULT", {})
    raise RuntimeError(f"API 응답 코드 {result.get('CODE')}: {result.get('MESSAGE')}")


Caller = Callable[[str, str, int, int, str], dict]


def fetch(kind: str, quarter: str, key: str, call: Caller = http_call, pause: float = 0.2) -> tuple[list[str], list[dict], int]:
    service = DATASETS[kind]["service"]
    first = body_of(call(key, service, 1, 1, quarter), service)
    total = int(first.get("list_total_count", 0))
    columns = list(first["row"][0].keys()) if first.get("row") else []
    rows: list[dict] = []
    for start in range(1, total + 1, PAGE_SIZE):
        end = min(start + PAGE_SIZE - 1, total)
        rows.extend(body_of(call(key, service, start, end, quarter), service).get("row", []))
        if pause:
            time.sleep(pause)
    return columns, rows, total


def save(kind: str, quarter: str, columns: list[str], rows: list[dict], total: int, raw: Path = RAW) -> tuple[Path, Path]:
    if total == 0 or not rows:
        raise RuntimeError(f"기준분기 {quarter}의 {kind} 행이 없어요. 아직 공개되지 않았을 수 있어요.")
    if len(rows) != total:
        raise RuntimeError(f"받은 행 {len(rows):,}건이 보고된 {total:,}건과 달라 저장하지 않았어요. 다시 실행해 주세요.")
    quarters = sorted({str(row.get("STDR_YYQU_CD")) for row in rows})
    if quarters != [quarter]:
        raise RuntimeError(f"요청한 분기 {quarter} 외의 행이 섞였어요: {quarters}")
    path = api_csv_path(raw, kind, quarter)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    spec = DATASETS[kind]
    meta = {
        "dataset": spec["dataset"],
        "dataset_id": spec["dataset_id"],
        "provider": PROVIDER,
        "service": spec["service"],
        "quarter": quarter,
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "total_count_reported": total,
        "rows_saved": len(rows),
        "file": path.name,
    }
    meta_path = path.with_suffix(".meta.json")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return path, meta_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="한 기준분기의 점포·추정매출 Open API 원천 수집")
    parser.add_argument("--quarter", required=True, help="기준분기 (예: 20262)")
    parser.add_argument("--kind", choices=["store", "sales", "all"], default="all")
    parser.add_argument("--check", action="store_true", help="1건만 받아 연결·전체 건수·컬럼만 확인")
    args = parser.parse_args(argv)
    if not (len(args.quarter) == 5 and args.quarter.isdigit() and args.quarter[4] in "1234"):
        sys.exit(f"[오류] 기준분기 형식이 잘못됐어요: {args.quarter} (예: 20262)")

    key = read_key()
    kinds = ["store", "sales"] if args.kind == "all" else [args.kind]
    try:
        for kind in kinds:
            service = DATASETS[kind]["service"]
            if args.check:
                first = body_of(http_call(key, service, 1, 1, args.quarter), service)
                columns = list(first["row"][0].keys()) if first.get("row") else []
                print(f"{kind}: 서비스 {service}, 기준분기 {args.quarter}, 전체 {int(first.get('list_total_count', 0)):,}건")
                print("  컬럼:", ", ".join(columns))
                continue
            columns, rows, total = fetch(kind, args.quarter, key)
            path, meta_path = save(kind, args.quarter, columns, rows, total)
            print(f"{kind}: {len(rows):,}건 저장 → {path.relative_to(ROOT)}")
            print(f"  수집 정보 → {meta_path.relative_to(ROOT)}")
    except RuntimeError as error:
        print(f"[오류] {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
