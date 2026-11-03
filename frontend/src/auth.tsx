import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabase";
import { assignAnonymousTransfer, captureAnonymousTransfer, clearTransferredAnonymousRecords, pendingAnonymousTransfer, transferReturnHash } from "./anonymousSession";
import { transferAnonymousRecords } from "./accountStore";
import { markLocalDataOwner } from "./favorites";

type AuthState = {
  client: SupabaseClient | null;
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
  transferStatus: "idle" | "saving" | "complete" | "failed";
  retryTransfer: () => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<AuthState["transferStatus"]>("idle");

  async function transferPendingRecords(userId: string): Promise<void> {
    if (!client) return;
    const snapshot = pendingAnonymousTransfer(localStorage, userId);
    if (!snapshot) return;
    setTransferStatus("saving");
    try {
      await transferAnonymousRecords(client, userId, snapshot);
      clearTransferredAnonymousRecords(localStorage, userId);
      setTransferStatus("complete");
    } catch (transferError) {
      setTransferStatus("failed");
      setError(transferError instanceof Error ? `기록 저장에 실패했습니다: ${transferError.message}` : "기록 저장에 실패했습니다.");
    }
  }

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        markLocalDataOwner(localStorage, data.session.user.id);
        assignAnonymousTransfer(localStorage, data.session.user.id);
        const returnHash = transferReturnHash(localStorage, data.session.user.id);
        if (returnHash && window.location.hash !== returnHash) window.location.hash = returnHash;
        void transferPendingRecords(data.session.user.id);
      }
      setError(sessionError?.message || null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (nextSession?.user) {
        markLocalDataOwner(localStorage, nextSession.user.id);
        assignAnonymousTransfer(localStorage, nextSession.user.id);
        const returnHash = transferReturnHash(localStorage, nextSession.user.id);
        if (returnHash && window.location.hash !== returnHash) window.location.hash = returnHash;
        void transferPendingRecords(nextSession.user.id);
      }
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthState>(() => ({
    client,
    configured: Boolean(client),
    loading,
    session,
    user: session?.user || null,
    error,
    transferStatus,
    async retryTransfer() {
      if (session?.user) await transferPendingRecords(session.user.id);
    },
    async signInWithKakao() {
      if (!client) {
        setError("Supabase 연결 정보가 설정되지 않았습니다.");
        return;
      }
      setError(null);
      captureAnonymousTransfer(localStorage, window.location.hash);
      const { error: signInError } = await client.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: window.location.origin },
      });
      if (signInError) setError(signInError.message);
    },
    async signOut() {
      if (!client) return;
      setError(null);
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) setError(signOutError.message);
    },
  }), [client, error, loading, session, transferStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider 안에서 useAuth를 사용해야 합니다.");
  return value;
}
