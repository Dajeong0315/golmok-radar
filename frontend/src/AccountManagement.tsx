import { useState } from "react";

import { API_BASE_URL } from "./api";
import { clearAccountRecordCache } from "./anonymousSession";
import { useAuth } from "./auth";
import { clearDeletedUserLocalSession } from "./supabase";
import "./accountManagement.css";

type Action = "records" | "membership";
type Failure = { detail?: { stage?: string; message?: string } };

export function AccountManagement() {
  const { client, user, signOut, reauthenticateWithKakao } = useAuth();
  const [action, setAction] = useState<Action | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needsReauth, setNeedsReauth] = useState(false);
  if (!client || !user) return null;

  const phrase = action === "membership" ? "회원 탈퇴" : "전체 삭제";
  const changeAction = (next: Action) => {
    setAction(next);
    setTyped("");
    setMessage("");
    setNeedsReauth(false);
  };
  const execute = async () => {
    if (!action || typed !== phrase || busy) return;
    setBusy(true);
    setMessage("");
    setNeedsReauth(false);
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session || data.session.user.id !== user.id) throw new Error("로그인 상태를 확인할 수 없습니다.");
      const response = await fetch(`${API_BASE_URL}/api/v1/account/${action}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as Failure | null;
        setNeedsReauth(failure?.detail?.stage === "reauthentication");
        throw new Error(failure?.detail?.message || "삭제를 완료하지 못했습니다. 다시 시도해 주세요.");
      }
      clearAccountRecordCache(localStorage, user.id);
      sessionStorage.removeItem("golmok-radar:review-own-shop:v1");
      if (action === "membership") {
        try { await client.auth.signOut({ scope: "local" }); } catch { /* The Auth user is already deleted. */ }
        clearDeletedUserLocalSession();
        window.history.replaceState(null, "", `${window.location.pathname}#home`);
        window.location.reload();
      } else {
        window.location.reload();
      }
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "삭제를 완료하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="mypage-section account-management">
    <div className="section-heading"><div><p className="eyebrow">계정 관리</p><h2>내 정보와 기록</h2></div></div>
    <p>현재 계정: {user.user_metadata?.nickname || user.email || "카카오 계정"}</p>
    <button type="button" onClick={() => void signOut()}>로그아웃</button>
    <div className="account-management-actions">
      <button type="button" onClick={() => changeAction("records")}>내 기록 전체 삭제</button>
      <button type="button" onClick={() => changeAction("membership")}>회원 탈퇴</button>
    </div>
    {action ? <div className="account-management-confirm">
      <h3>{action === "records" ? "내 기록 전체 삭제" : "회원 탈퇴"}</h3>
      <p>{action === "records"
        ? "테스트·비교 리포트·관심 상권·매물 워크시트·리뷰 비교 기록을 삭제합니다. 카카오 로그인 계정은 유지됩니다."
        : "모든 기록과 서비스 로그인 계정을 삭제하고 카카오 연결을 해제합니다. 카카오 계정 자체는 삭제되지 않습니다."}</p>
      <label htmlFor="account-confirm-word">계속하려면 <strong>{phrase}</strong>를 입력해 주세요.</label>
      <input id="account-confirm-word" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
      <div><button type="button" disabled={busy || typed !== phrase} onClick={() => void execute()}>{busy ? "처리 중" : phrase}</button><button type="button" disabled={busy} onClick={() => setAction(null)}>취소</button></div>
    </div> : null}
    {message ? <p className="account-management-message" role="alert">{message}</p> : null}
    {needsReauth ? <button type="button" onClick={() => void reauthenticateWithKakao()}>카카오로 다시 인증하기</button> : null}
  </section>;
}
