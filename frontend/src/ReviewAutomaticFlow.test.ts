import { afterEach, describe, expect, it, vi } from "vitest";
import { initialOwnIndustry, rememberOwnIndustry } from "./ReviewAutomaticFlow";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("own-shop review industry", () => {
  it("ignores the area-review URL and its shared industry selection", () => {
    vi.stubGlobal("window", { location: { hash: "#reviews?area=3110135&industry=CS200031" } });
    const local = storage();
    local.setItem("golmok-radar:industry:v1", "CS200031");
    expect(initialOwnIndustry(local)).toBe("CS100010");
    rememberOwnIndustry("CS300011", local);
    expect(initialOwnIndustry(local)).toBe("CS300011");
    expect(local.getItem("golmok-radar:industry:v1")).toBe("CS200031");
  });

  it("falls back to the default for an invalid saved code", () => {
    const local = storage();
    rememberOwnIndustry("invalid", local);
    expect(initialOwnIndustry(local)).toBe("CS100010");
  });
});
