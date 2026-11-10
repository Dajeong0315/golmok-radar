#!/usr/bin/env bash
# 골목 레이더 서버 상태를 한 번에 확인합니다 (Lightsail, Phase 46).
# 사용: bash scripts/server_status.sh [백엔드 도메인]
#   예: bash scripts/server_status.sh api-golmok-radar.axworks.site
# 비밀값은 출력하지 않습니다.

SERVICE="${SERVICE:-golmok-radar-backend}"
API_DOMAIN="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/backend/.venv/bin/python"

echo "== 1. 서비스 상태"
systemctl status "$SERVICE" --no-pager 2>/dev/null | sed -n '1,3p'
echo "Caddy: $(systemctl is-active caddy 2>/dev/null)"

echo
echo "== 2. 백엔드 응답"
echo -n "서버 안 (127.0.0.1:8000): "; curl -sS -m 5 http://127.0.0.1:8000/health; echo
if [ -n "$API_DOMAIN" ]; then
  echo -n "인터넷 (https://$API_DOMAIN): "; curl -sS -m 10 "https://$API_DOMAIN/health"; echo
fi

echo
echo "== 3. 최근 24시간 오류 로그 (최대 20줄)"
journalctl -u "$SERVICE" --since "24 hours ago" --no-pager 2>/dev/null | grep -iE "error|exception|traceback| 5[0-9][0-9] " | tail -20 || true

echo
echo "== 4. 코드 버전과 디스크"
git -C "$ROOT" log -1 --oneline
df -h / | tail -1
du -sh "$ROOT/database/raw/reviews" 2>/dev/null || echo "리뷰 보관 폴더 없음"

echo
echo "== 5. 설정 점검"
(cd "$ROOT/backend" && "$PYTHON" -m app.env_check)

echo
echo "== 6. 리뷰 보고서 생성률 (analysis_result 기준)"
(cd "$ROOT/backend" && "$PYTHON" -m app.review_metrics) || echo "아직 집계할 기록 없음"
