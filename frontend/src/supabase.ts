import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) client = createClient(url, anonKey);
  return client;
}

/** Last-resort browser cleanup after the server has deleted the Auth user. */
export function clearDeletedUserLocalSession(): void {
  if (!url) return;
  const projectRef = new URL(url).hostname.split(".")[0];
  if (!/^[a-z0-9]+$/.test(projectRef)) return;
  localStorage.removeItem(`sb-${projectRef}-auth-token`);
  localStorage.removeItem(`sb-${projectRef}-auth-token-user`);
}
