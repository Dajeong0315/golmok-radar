import { describe, expect, it } from "vitest";

import { loadFavorites, mayImportLocalData, mayReadLocalData, mergeFavorites, sanitizeFavorites, toggleComparison, toggleFavorite, SYNC_OWNER_KEY } from "./favorites";


describe("favorites", () => {
  it("loads unique string codes and recovers from invalid JSON", () => {
    expect(loadFavorites({ getItem: () => '["1","1","2",3]' })).toEqual(["1", "2"]);
    expect(loadFavorites({ getItem: () => "invalid" })).toEqual([]);
  });

  it("adds and removes a favorite", () => {
    expect(toggleFavorite(["1"], "2")).toEqual(["1", "2"]);
    expect(toggleFavorite(["1", "2"], "1")).toEqual(["2"]);
  });

  it("removes stale codes", () => {
    expect(sanitizeFavorites(["1", "9"], new Set(["1", "2"]))).toEqual(["1"]);
  });

  it("allows up to four comparison codes", () => {
    expect(toggleComparison(["1", "2", "3"], "4")).toEqual({ codes: ["1", "2", "3", "4"], limitReached: false });
    expect(toggleComparison(["1", "2", "3", "4"], "5")).toEqual({ codes: ["1", "2", "3", "4"], limitReached: true });
    expect(toggleComparison(["1", "2"], "1")).toEqual({ codes: ["2"], limitReached: false });
  });

  it("merges only the same account's local cache", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value) };
    expect(mergeFavorites(["1", "2"], ["2", "3"])).toEqual(["1", "2", "3"]);
    expect(mayImportLocalData(storage, "user-a")).toBe(true);
    expect(mayImportLocalData(storage, "user-a")).toBe(true);
    expect(mayImportLocalData(storage, "user-b")).toBe(false);
  });

  it("does not expose an account-owned cache after logout", () => {
    const values = new Map([[SYNC_OWNER_KEY, "account-a"], ["favorites", '["1"]']]);
    const storage = { getItem: (key: string) => values.get(key) || null };
    expect(mayReadLocalData(storage, null)).toBe(false);
    expect(loadFavorites({ getItem: (key: string) => key === "golmok-radar:favorites:v1" ? values.get("favorites") || null : values.get(key) || null }, null)).toEqual([]);
    expect(mayReadLocalData(storage, "account-a")).toBe(true);
  });
});

