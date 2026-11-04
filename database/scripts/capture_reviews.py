"""Run one bounded Phase 17 review capture from a local, untracked target file.

Target file format:
{"targets": [{"provider": "naver", "public_url": "https://...", "peer_label": "A"}]}
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.config import get_settings
from backend.app.review_capture import CaptureTarget, PublicReviewBrowserCollector


OUTPUT_DIR = ROOT / "database" / "raw" / "reviews"
RETENTION_DAYS = 90


def purge_expired_captures(now: datetime) -> int:
    removed = 0
    for path in OUTPUT_DIR.glob("capture-*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            captured_at = datetime.fromisoformat(payload["captured_at"])
        except (OSError, ValueError, KeyError, TypeError):
            continue
        if captured_at + timedelta(days=RETENTION_DAYS) <= now:
            path.unlink()
            removed += 1
    return removed


def main() -> None:
    parser = argparse.ArgumentParser(description="Capture a bounded public-review sample.")
    parser.add_argument("targets", type=Path, nargs="?", help="Untracked JSON file containing up to five public targets.")
    parser.add_argument(
        "--target",
        action="append",
        default=[],
        metavar="PROVIDER,URL,LABEL",
        help="One public target; repeat up to five times instead of providing a file.",
    )
    args = parser.parse_args()

    if bool(args.targets) == bool(args.target):
        parser.error("Provide either a target JSON file or one or more --target values.")
    if args.targets:
        payload = json.loads(args.targets.read_text(encoding="utf-8"))
        targets = [CaptureTarget(**item) for item in payload["targets"]]
    else:
        targets = []
        for value in args.target:
            try:
                provider, public_url, peer_label = value.split(",", maxsplit=2)
            except ValueError as exc:
                raise ValueError("--target must be PROVIDER,URL,LABEL") from exc
            targets.append(CaptureTarget(provider=provider, public_url=public_url, peer_label=peer_label))
    settings = get_settings()
    collector = PublicReviewBrowserCollector(
        settings.review_capture_encryption_key,
        executable_path=settings.review_capture_browser_path,
    )
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    purge_expired_captures(now)
    reviews = collector.capture(targets)
    output_path = OUTPUT_DIR / f"capture-{now:%Y%m%dT%H%M%SZ}.json"
    output_path.write_text(json.dumps({
        "captured_at": now.isoformat(),
        "expires_at": (now + timedelta(days=RETENTION_DAYS)).isoformat(),
        "review_count": len(reviews),
        "reviews": [{
            "provider": review.provider,
            "peer_label": review.peer_label,
            "encrypted_text": review.encrypted_text.decode("utf-8"),
            "fetched_at": review.fetched_at.isoformat(),
        } for review in reviews],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Captured {len(reviews)} reviews into {output_path.name}.")


if __name__ == "__main__":
    main()
