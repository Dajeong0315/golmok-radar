import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchComparison, fetchIndustries } from "./api";
import { isQuarterCode, quarterFromHash, quarterLabel, resolveSelectedQuarter } from "./quarterSelection";
import type { QuarterListResponse } from "./types";

const LIST: QuarterListResponse = {
  default_quarter: "20262",
  quarters: [
    { code: "20262", label: "2026년 2분기", store_rows: 1, sales_rows: 1, population_rows: 1 },
    { code: "20254", label: "2025년 4분기", store_rows: 1, sales_rows: 1, population_rows: 1 },
  ],
  notice: "",
};

describe("quarter selection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads only well-formed quarter codes from the hash", () => {
    expect(quarterFromHash("#compare?codes=1,2&quarter=20254")).toBe("20254");
    expect(quarterFromHash("#compare?codes=1,2&quarter=2025Q4")).toBe("");
    expect(quarterFromHash("#explore")).toBe("");
    expect(isQuarterCode("20265")).toBe(false);
  });

  it("labels quarters and falls back to the latest published wording", () => {
    expect(quarterLabel("20262")).toBe("2026년 2분기");
    expect(quarterLabel("")).toBe("최신 공개 분기");
  });

  it("keeps a loaded quarter and replaces an unloaded one with the default", () => {
    expect(resolveSelectedQuarter("20254", LIST)).toBe("20254");
    expect(resolveSelectedQuarter("20193", LIST)).toBe("20262");
    expect(resolveSelectedQuarter("", LIST)).toBe("20262");
    expect(resolveSelectedQuarter("20254", null)).toBe("20254");
  });

  it("sends the quarter only when one is chosen", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(url); return new Response("[]"); }));
    await fetchComparison(["1", "2"], "CS100010");
    await fetchComparison(["1", "2"], "CS100010", undefined, "20254");
    await fetchIndustries();
    expect(urls[0]).not.toContain("quarter=");
    expect(urls[1]).toContain("quarter=20254");
    expect(urls[2]).toMatch(/industries\?$/);
  });
});
