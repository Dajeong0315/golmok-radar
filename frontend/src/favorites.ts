export const FAVORITES_KEY = "golmok-radar:favorites:v1";
export const SYNC_OWNER_KEY = "golmok-radar:sync-owner:v1";

export function mayReadLocalData(storage: Pick<Storage, "getItem">, userId?: string | null): boolean {
  if (userId === undefined) return true;
  const owner = storage.getItem(SYNC_OWNER_KEY);
  return owner === null || owner === userId;
}

export function markLocalDataOwner(storage: Pick<Storage, "setItem">, userId: string): void {
  storage.setItem(SYNC_OWNER_KEY, userId);
}

export function loadFavorites(storage: Pick<Storage, "getItem">, userId?: string | null): string[] {
  if (!mayReadLocalData(storage, userId)) return [];
  try {
    const value = JSON.parse(storage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? [...new Set(value.filter((code): code is string => typeof code === "string"))] : [];
  } catch {
    return [];
  }
}

export function sanitizeFavorites(codes: string[], validCodes: Set<string>): string[] {
  return codes.filter((code) => validCodes.has(code));
}

export function toggleFavorite(codes: string[], code: string): string[] {
  return codes.includes(code) ? codes.filter((item) => item !== code) : [...codes, code];
}

export function mergeFavorites(local: string[], remote: string[]): string[] {
  return [...new Set([...local, ...remote])];
}

/**
 * Local storage can contain a previous account's cache. Only import it into
 * Supabase for a new account when it is anonymous, or belongs to that account.
 */
export function mayImportLocalData(storage: Pick<Storage, "getItem" | "setItem">, userId: string): boolean {
  const allowed = mayReadLocalData(storage, userId);
  markLocalDataOwner(storage, userId);
  return allowed;
}

export function toggleComparison(
  codes: string[],
  code: string,
  maximum = 4,
): { codes: string[]; limitReached: boolean } {
  if (codes.includes(code)) {
    return { codes: codes.filter((item) => item !== code), limitReached: false };
  }
  if (codes.length >= maximum) {
    return { codes, limitReached: true };
  }
  return { codes: [...codes, code], limitReached: false };
}

