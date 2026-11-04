const AUTH_RETURN_HASH_KEY = "golmok-radar:auth-return-hash";

type ReturnStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function rememberAuthReturnHash(storage: ReturnStorage, hash: string): void {
  storage.setItem(AUTH_RETURN_HASH_KEY, hash.startsWith("#") ? hash : "#home");
}

export function consumeAuthReturnHash(storage: ReturnStorage, transferHash: string | null): string | null {
  const savedHash = storage.getItem(AUTH_RETURN_HASH_KEY);
  storage.removeItem(AUTH_RETURN_HASH_KEY);
  if (transferHash?.startsWith("#")) return transferHash;
  return savedHash?.startsWith("#") ? savedHash : null;
}
