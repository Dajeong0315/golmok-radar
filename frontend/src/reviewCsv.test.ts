import { describe, expect, it } from "vitest";

import { parseReviewCsv } from "./reviewCsv";

describe("review CSV contract", () => {
  it("splits own and nearby rows and preserves quoted commas", () => {
    const parsed = parseReviewCsv('group,review\nown,"커피가 맛있고, 친절해요"\nnearby,대기가 오래 걸려요');
    expect(parsed.own).toEqual(["커피가 맛있고, 친절해요"]);
    expect(parsed.nearby).toEqual(["대기가 오래 걸려요"]);
  });

  it("rejects missing columns and unknown groups", () => {
    expect(() => parseReviewCsv("kind,text\nown,맛있어요")).toThrow("group, review");
    expect(() => parseReviewCsv("group,review\nother,맛있어요\nnearby,친절해요")).toThrow("own 또는 nearby");
  });
});
