"""Count privacy-safe review report outcomes from the local audit log."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from .review_report import REPORT_DIR


def summarize_report_outcomes(path: Path) -> dict:
    counts: Counter[str] = Counter()
    flows: Counter[str] = Counter()
    partial_failures = 0
    if path.exists():
        with path.open(encoding="utf-8") as source:
            for line in source:
                entry = json.loads(line)
                if entry.get("event") != "analysis_result":
                    continue
                status = entry.get("status")
                if status not in {"available", "limited", "insufficient_sample"}:
                    continue
                counts[status] += 1
                flows[entry.get("flow", "unknown")] += 1
                partial_failures += int(entry.get("failed_count", 0) > 0)
    completed = sum(counts.values())
    generated = counts["available"] + counts["limited"]
    return {
        "completed_requests": completed,
        "generated_reports": generated,
        "generation_rate": round(generated / completed, 4) if completed else None,
        "statuses": dict(counts),
        "flows": dict(flows),
        "requests_with_failed_places": partial_failures,
    }


if __name__ == "__main__":
    print(json.dumps(summarize_report_outcomes(REPORT_DIR / "audit.jsonl"), ensure_ascii=False))
