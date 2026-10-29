export const FAVORITES_KEY = "golmok-radar:favorites:v1";

export function loadFavorites(storage: Pick<Storage, "getItem">): string[] {
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

