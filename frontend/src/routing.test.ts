import { describe, expect, it } from "vitest";
import { isExplorerHash } from "./routing";

describe("home and legacy exploration links", () => {
  it.each(["", "#home", "#workflow", "#quiz", "#compare?codes=1,2"])("keeps %s out of the exploration fallback", (hash) => {
    expect(isExplorerHash(hash)).toBe(false);
  });
  it.each(["#explore", "#top", "#explorer-title", "#favorites-title"])("preserves %s exploration links", (hash) => {
    expect(isExplorerHash(hash)).toBe(true);
  });
});
