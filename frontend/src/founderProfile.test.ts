import { describe, expect, it } from "vitest";

import { FOUNDER_QUESTIONS, profileTitle, sanitizeAnswers } from "./founderProfile";

describe("founder profile", () => {
  it("has exactly six questions and four unique choices each", () => {
    expect(FOUNDER_QUESTIONS).toHaveLength(6);
    FOUNDER_QUESTIONS.forEach((question) => {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options.map((option) => option.id)).size).toBe(4);
    });
  });

  it("removes unknown question and answer values", () => {
    expect(sanitizeAnswers({ business: "cafe", demand: "invalid", unknown: "x" })).toEqual({ business: "cafe" });
  });

  it("builds a transparent result title from selected axes", () => {
    expect(profileTitle({ demand: "neighborhood", operation: "solo" })).toBe("동네 단골을 만드는 소형 효율형");
  });
});
