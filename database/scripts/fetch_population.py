"""서울시 상권분석서비스(길단위인구-상권)를 서울 열린데이터광장 Open API로 내려받는다.

실행 (프로젝트 폴더 golmok-radar 에서):
    py database\\scripts\\fetch_population.py
    py database\\scripts\\fetch_population.py --check     # 1건만 받아 연결·서비스명 확인

- 인증키는 backend/.env 의 SEOUL_OPEN_API_KEY 에서 읽고, 화면·파일 어디에도 출력하지 않는다.
- 받은 행은 가공하지 않고 database/raw/population/ 에 CSV(UTF-8)로 저장한다.
- 같은 폴더에 수집 정보(서비스명, 수집 시각, 행 수, 기준분기 범위)를 JSON으로 남긴다.
"""
import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / "backend" / ".env"
OUT_DIR = ROOT / "database" / "raw" / "population"

# 열린데이터광장 데이터셋 페이지의 'Open API' 탭에 적힌 서비스명과 다르면 --service 로 바꿔서 실행한다.
DEFAULT_SERVICE = "VwsmTrdarFlpopQq"
PAGE_SIZE = 1000  # 열린데이터광장은 한 번에 최대 1,000건


def read_key() -> str:
    if not ENV_FILE.exists():
        sys.exit(f"[오류] {ENV_FILE} 파일이 없어요.")
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        if line.strip().startswith("SEOUL_OPEN_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key
    sys.exit("[오류] backend/.env 에 SEOUL_OPEN_API_KEY=... 줄이 없거나 값이 비어 있어요.")


def call(key: str, service: str, start: int, end: int) -> dict:
    url = f"http://openapi.seoul.go.kr:8088/{key}/json/{service}/{start}/{end}/"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"[오류] 서버가 HTTP {e.code} 를 돌려줬어요. 네트워크(회사·학교 방화벽)나 주소를 확인해 주세요.")
    except urllib.error.URLError as e:
        sys.exit(f"[오류] 서버에 연결하지 못했어요: {e.reason}")
    except json.JSONDecodeError:
        sys.exit("[오류] 응답이 JSON이 아니에요. 서비스명이 맞는지 확인해 주세요.")


def body_of(data: dict, service: str) -> dict:
    if service in data:
        return data[service]
    result = data.get("RESULT", {})
    sys.exit(f"[오류] API 응답 코드 {result.get('CODE')}: {result.get('MESSAGE')}\n"
             f"  - 인증키가 맞는지, 서비스명 '{service}' 이 Open API 탭과 같은지 확인해 주세요.")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--service", default=DEFAULT_SERVICE)
    p.add_argument("--check", action="store_true", help="1건만 받아서 연결과 컬럼만 확인")
    args = p.parse_args()

    key = read_key()
    first = body_of(call(key, args.service, 1, 1), args.service)
    total = int(first.get("list_total_count", 0))
    columns = list(first["row"][0].keys()) if first.get("row") else []
    print(f"연결 성공: 서비스 {args.service}, 전체 {total:,}건")
    print("컬럼:", ", ".join(columns))
    if args.check:
        return

    rows = []
    for start in range(1, total + 1, PAGE_SIZE):
        end = min(start + PAGE_SIZE - 1, total)
        page = body_of(call(key, args.service, start, end), args.service)
        rows.extend(page.get("row", []))
        print(f"  {end:,} / {total:,}")
        time.sleep(0.2)

    if len(rows) != total:
        print(f"[주의] 받은 행 {len(rows):,}건이 전체 {total:,}건과 달라요. 다시 실행해 보세요.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d")
    out_csv = OUT_DIR / f"길단위인구-상권_{args.service}_{stamp}.csv"
    with out_csv.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(rows)

    quarter_col = next((c for c in columns if c.upper().startswith("STDR_YYQU")), None)
    quarters = sorted({str(r.get(quarter_col)) for r in rows}) if quarter_col else []
    meta = {
        "dataset": "서울시 상권분석서비스(길단위인구-상권)",
        "dataset_id": "OA-15568",
        "provider": "서울신용보증재단 / 서울 열린데이터광장 Open API",
        "service": args.service,
        "fetched_at": datetime.now().isoformat(timespec="seconds"),
        "total_count_reported": total,
        "rows_saved": len(rows),
        "quarter_column": quarter_col,
        "quarters": quarters,
        "file": out_csv.name,
    }
    out_meta = out_csv.with_suffix(".meta.json")
    out_meta.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out_csv.relative_to(ROOT)}")
    print(f"저장: {out_meta.relative_to(ROOT)}")
    if quarters:
        print(f"기준분기 범위: {quarters[0]} ~ {quarters[-1]} ({len(quarters)}개)")


if __name__ == "__main__":
    main()
