r"""K-Startup 모집 중 지원사업 공고 원문 JSON을 수집한다.

실행 (프로젝트 루트):
    py database\scripts\fetch_kstartup.py
    py database\scripts\fetch_kstartup.py --check

인증키는 backend/.env의 K_STARTUP_API_KEY에서 읽고 출력하거나 파일에 저장하지 않는다.
응답 원문은 수정하지 않고 database/raw/kstartup/에 페이지별로 보관한다.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app.support_programs import decode_response, fetch_page, normalize_program  # noqa: E402


ENV_FILE = BACKEND / ".env"
OUT_DIR = ROOT / "database" / "raw" / "kstartup"


def read_key() -> str:
    if not ENV_FILE.exists():
        sys.exit(f"[오류] {ENV_FILE} 파일이 없습니다.")
    for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        if line.strip().startswith("K_STARTUP_API_KEY="):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            if key:
                return key
    sys.exit("[오류] backend/.env에 K_STARTUP_API_KEY=... 값이 필요합니다.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="응답 계약만 확인하고 저장하지 않음")
    parser.add_argument("--per-page", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.per_page <= 1000:
        sys.exit("[오류] --per-page는 1~1000이어야 합니다.")

    key = read_key()
    fetched_at = datetime.now()
    pages: list[dict[str, object]] = []
    normalized_count = 0
    total_count: int | None = None
    page_count = 1
    for page in range(1, 101):
        try:
            raw = fetch_page(key, page=page, per_page=args.per_page)
            payload, rows = decode_response(raw)
        except (RuntimeError, ValueError) as error:
            sys.exit(f"[오류] K-Startup 응답을 검증하지 못했습니다: {error}")
        if total_count is None:
            value = payload.get("totalCount") or payload.get("matchCount")
            total_count = int(value) if value is not None else None
            if total_count is not None:
                page_count = max(1, math.ceil(total_count / args.per_page))
        for row in rows:
            try:
                normalize_program(row)
            except ValueError as error:
                sys.exit(f"[오류] 공고 {row.get('pbanc_sn', '식별자 없음')} 정규화 실패: {error}")
            normalized_count += 1
        filename = f"kstartup_announcements_{fetched_at:%Y%m%d}_p{page:03d}.json"
        pages.append({"page": page, "file": filename, "rows": len(rows), "raw": raw})
        if page >= page_count or not rows:
            break

    print(f"연결 성공: 모집 중 공고 {normalized_count:,}건, {len(pages)}페이지")
    if args.check:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for item in pages:
        (OUT_DIR / str(item["file"])).write_bytes(item.pop("raw"))
    meta = {
        "dataset": "K-Startup 지원사업 공고 정보",
        "provider": "창업진흥원",
        "fetched_at": fetched_at.isoformat(timespec="seconds"),
        "filter": "rcrt_prgs_yn=Y",
        "total_count": total_count,
        "normalized_count": normalized_count,
        "pages": pages,
    }
    meta_path = OUT_DIR / f"kstartup_announcements_{fetched_at:%Y%m%d}.meta.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {meta_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
