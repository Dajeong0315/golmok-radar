import { describe, expect, it } from "vitest";

import { ANONYMOUS_RETENTION_MS, ANONYMOUS_SESSION_KEY, ANONYMOUS_TRANSFER_KEY, assignAnonymousTransfer, captureAnonymousTransfer, claimAccountLocalCache, clearTransferredAnonymousRecords, expireAnonymousSession, touchAnonymousActivity, transferReturnHash } from "./anonymousSession";
import { FAVORITES_KEY, SYNC_OWNER_KEY } from "./favorites";
import { PROFILE_HISTORY_KEY } from "./founderProfile";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
}

describe("anonymous session retention", () => {
  it("keeps records at 59:59 and removes only anonymous keys at 60 minutes", () => {
    const local = storage();
    local.setItem(FAVORITES_KEY, '["3120052"]');
    expect(expireAnonymousSession(local, 0)).toMatchObject({ state: "active" });
    expect(expireAnonymousSession(local, ANONYMOUS_RETENTION_MS - 1)).toMatchObject({ state: "active" });
    expect(expireAnonymousSession(local, ANONYMOUS_RETENTION_MS)).toMatchObject({ state: "expired" });
    expect(local.getItem(FAVORITES_KEY)).toBeNull();
    expect(local.getItem(ANONYMOUS_SESSION_KEY)).toBeNull();
  });

  it("extends only explicit activity, not a read or reminder", () => {
    const local = storage();
    local.setItem(FAVORITES_KEY, '["3120052"]');
    expireAnonymousSession(local, 0);
    expect(touchAnonymousActivity(local, 30 * 60_000)).toMatchObject({ state: "active" });
    expect(expireAnonymousSession(local, 89 * 60_000 + 59_999)).toMatchObject({ state: "active" });
    expect(expireAnonymousSession(local, 90 * 60_000)).toMatchObject({ state: "expired" });
  });

  it("protects a valid snapshot during OAuth and scopes it after authentication", () => {
    const local = storage();
    local.setItem(FAVORITES_KEY, '["3120052"]');
    expireAnonymousSession(local, 0);
    const snapshot = captureAnonymousTransfer(local, "#explore", ANONYMOUS_RETENTION_MS - 1);
    expect(snapshot?.records[FAVORITES_KEY]).toBe('["3120052"]');
    expect(expireAnonymousSession(local, ANONYMOUS_RETENTION_MS + 1)).toMatchObject({ state: "protected" });
    assignAnonymousTransfer(local, "user-a");
    expect(JSON.parse(local.getItem(ANONYMOUS_TRANSFER_KEY) || "{}").userId).toBe("user-a");
    expect(transferReturnHash(local, "user-a")).toBe("#explore");
    expect(expireAnonymousSession(local, ANONYMOUS_RETENTION_MS + 20 * 60_000)).toMatchObject({ state: "protected" });
  });

  it("does not reclassify a previous account cache as anonymous after logout", () => {
    const local = storage();
    local.setItem(FAVORITES_KEY, '["3120052"]');
    local.setItem(SYNC_OWNER_KEY, "user-a");
    expect(expireAnonymousSession(local, 0)).toMatchObject({ state: "empty" });
    expect(captureAnonymousTransfer(local, "#explore", 0)).toBeNull();
  });

  it("clears a previous account cache before assigning it to a different account", () => {
    const local = storage();
    local.setItem(SYNC_OWNER_KEY, "user-a");
    local.setItem(FAVORITES_KEY, '["private-a"]');
    local.setItem(PROFILE_HISTORY_KEY, '[{"private":"a"}]');
    claimAccountLocalCache(local, "user-b");
    expect(local.getItem(FAVORITES_KEY)).toBeNull();
    expect(local.getItem(PROFILE_HISTORY_KEY)).toBeNull();
    expect(local.getItem(SYNC_OWNER_KEY)).toBe("user-b");
  });

  it("keeps records changed while an anonymous transfer is saving", () => {
    const local = storage();
    local.setItem(FAVORITES_KEY, '["first"]');
    expireAnonymousSession(local, 0);
    captureAnonymousTransfer(local, "#explore", 1);
    assignAnonymousTransfer(local, "user-a");
    claimAccountLocalCache(local, "user-a");
    local.setItem(FAVORITES_KEY, '["first","new"]');
    clearTransferredAnonymousRecords(local, "user-a");
    expect(local.getItem(FAVORITES_KEY)).toBe('["first","new"]');
    expect(local.getItem(ANONYMOUS_TRANSFER_KEY)).toBeNull();
  });
});
