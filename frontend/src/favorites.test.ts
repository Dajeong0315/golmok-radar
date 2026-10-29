import { describe, expect, it } from "vitest";

import { loadFavorites, sanitizeFavorites, toggleComparison, toggleFavorite } from "./favorites";


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
});

