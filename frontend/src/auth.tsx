import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabase";
import { consumeAuthReturnHash, rememberAuthReturnHash } from "./authReturn";
import { assignAnonymousTransfer, captureAnonymousTransfer, claimAccountLocalCache, clearTransferredAnonymousRecords, pendingAnonymousTransfer, transferReturnHash } from "./anonymousSession";
import { transferAnonymousRecords } from "./accountStore";

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

function restoreAuthReturnHash(storage: Storage, userId: string): void {
  const destination = consumeAuthReturnHash(storage, transferReturnHash(localStorage, userId));
  if (!destination) return;
  if (window.location.hash !== destination) window.location.hash = destination;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState<AuthState["transferStatus"]>("idle");
  const activeUserId = useRef<string | null>(null);

  async function transferPendingRecords(userId: string): Promise<void> {
    if (!client) return;
    const snapshot = pendingAnonymousTransfer(localStorage, userId);
    if (!snapshot) return;
    setTransferStatus("saving");
    try {
      await transferAnonymousRecords(client, userId, snapshot);
      if (activeUserId.current !== userId) return;
      clearTransferredAnonymousRecords(localStorage, userId);
      setTransferStatus("complete");
    } catch (transferError) {
      if (activeUserId.current !== userId) return;
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
      const nextUserId = data.session?.user?.id || null;
      if (activeUserId.current !== nextUserId) setTransferStatus("idle");
      activeUserId.current = nextUserId;
      if (data.session?.user) {
        claimAccountLocalCache(localStorage, data.session.user.id);
        assignAnonymousTransfer(localStorage, data.session.user.id);
        restoreAuthReturnHash(sessionStorage, data.session.user.id);
        void transferPendingRecords(data.session.user.id);
      }
      setError(sessionError?.message || null);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      const nextUserId = nextSession?.user?.id || null;
      if (activeUserId.current !== nextUserId) setTransferStatus("idle");
      activeUserId.current = nextUserId;
      if (nextSession?.user) {
        claimAccountLocalCache(localStorage, nextSession.user.id);
        assignAnonymousTransfer(localStorage, nextSession.user.id);
        restoreAuthReturnHash(sessionStorage, nextSession.user.id);
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
      rememberAuthReturnHash(sessionStorage, window.location.hash);
      captureAnonymousTransfer(localStorage, window.location.hash);
      const { data, error: signInError } = await client.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      if (!data.url) {
        setError("카카오 로그인 주소를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      window.location.assign(data.url);
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
