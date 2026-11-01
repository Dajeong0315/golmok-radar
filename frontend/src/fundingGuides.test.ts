import { describe, expect, it } from "vitest";

import { parseFundingAreaCode, selectBankFundingGuides } from "./fundingGuides";

describe("selectBankFundingGuides", () => {
  it("shows the IBK job candidate for a team operator", () => {
    const guides = selectBankFundingGuides({ operation: "team", risk: "balanced" }, "existing");
    expect(guides.map((guide) => guide.id)).toEqual(["ibk-jobs", "kdb-onlending"]);
  });

  it("shows the IBK startup candidate for a growth-oriented founder", () => {
    const guides = selectBankFundingGuides({ operation: "solo", risk: "growth" }, "existing");
    expect(guides.map((guide) => guide.id)).toEqual(["ibk-startup", "kdb-onlending"]);
  });

  it("does not claim a specific loan before business registration", () => {
    const guides = selectBankFundingGuides({ operation: "solo", risk: "lean" }, "pre_startup");
    expect(guides[0].id).toBe("ibk-box");
    expect(guides.every((guide) => guide.reason.includes("등록 후 다시 확인"))).toBe(true);
  });

  it("returns exactly two dated official sources", () => {
    const guides = selectBankFundingGuides(null);
    expect(guides).toHaveLength(2);
    expect(guides.every((guide) => guide.sourceUrl.startsWith("https://"))).toBe(true);
    expect(guides.every((guide) => guide.checkedAt === "2026-11-01")).toBe(true);
  });
});

describe("parseFundingAreaCode", () => {
  it("reads the selected trade-area code", () => {
    expect(parseFundingAreaCode("#funding?code=3110008")).toBe("3110008");
    expect(parseFundingAreaCode("#funding")).toBe("");
  });
});
