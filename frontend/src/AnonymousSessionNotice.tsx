import { useCallback, useEffect, useState } from "react";

import { anonymousNotice, formatRemainingTime, markAnonymousReminderShown, touchAnonymousActivity, type AnonymousStatus } from "./anonymousSession";
import { useAuth } from "./auth";

const initial: AnonymousStatus = { state: "empty", remainingMs: 0, hasRecords: false };

export function AnonymousSessionNotice() {
  const { loading, user } = useAuth();
  const [status, setStatus] = useState<AnonymousStatus>(initial);
  const [showReminder, setShowReminder] = useState(false);

  const refresh = useCallback(() => {
    if (loading) return;
    if (user) { setStatus({ state: "empty", remainingMs: 0, hasRecords: false }); setShowReminder(false); return; }
    const next = anonymousNotice(localStorage);
    setStatus(next.status);
    if (next.showReminder) {
      markAnonymousReminderShown(localStorage);
      setShowReminder(true);
    }
  }, [loading, user]);

  useEffect(() => {
    refresh();
    const userActivity = () => {
      if (loading || user) return;
      const next = touchAnonymousActivity(localStorage);
      setStatus(next);
      setShowReminder(false);
    };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(refresh, 30_000);
    const options = { capture: true };
    ["click", "input", "change", "scroll", "hashchange"].forEach((event) => window.addEventListener(event, userActivity, options));
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("golmok-anonymous-session", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      ["click", "input", "change", "scroll", "hashchange"].forEach((event) => window.removeEventListener(event, userActivity, options));
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("golmok-anonymous-session", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loading, refresh, user]);

  if (status.state === "expired") return <aside className="anonymous-notice anonymous-notice--expired" role="status">비로그인 이용 기록이 만료됐어요. 새로 시작하면 마지막 활동 후 1시간 동안 임시 보관됩니다.</aside>;
  if (status.state !== "active" || !status.hasRecords) return null;
  const urgent = status.remainingMs <= 10 * 60_000;
  const critical = status.remainingMs <= 2 * 60_000;
  return <aside className={`anonymous-notice ${urgent ? "anonymous-notice--urgent" : ""}`} role="status">
    <span>{urgent ? critical ? `임시 기록이 ${formatRemainingTime(status.remainingMs)} 뒤 만료됩니다. 지금 계속 이용하거나 로그인해 주세요.` : `임시 기록이 ${formatRemainingTime(status.remainingMs)} 뒤 만료돼요.` : "현재 기록은 로그인하지 않으면 마지막 활동 후 1시간 뒤 사라져요."} 로그인하면 남아 있는 기록을 계정에 저장할 수 있어요.</span>
    {urgent ? <button onClick={() => { setStatus(touchAnonymousActivity(localStorage)); setShowReminder(false); }}>계속 이용하기</button> : null}
    {showReminder && !urgent ? <small>기록을 계속 보관하려면 카카오로 로그인해 주세요.</small> : null}
  </aside>;
}
