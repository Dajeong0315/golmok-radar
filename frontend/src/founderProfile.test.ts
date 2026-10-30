import { describe, expect, it } from "vitest";

import { FOUNDER_QUESTIONS, profileTitle, profileTitleLines, sanitizeAnswers } from "./founderProfile";

describe("founder profile", () => {
  it("has exactly six questions and four unique choices each", () => {
    expect(FOUNDER_QUESTIONS).toHaveLength(6);
    FOUNDER_QUESTIONS.forEach((question) => {
      expect(question.options).toHaveLength(4);
      expect(new Set(question.options.map((option) => option.id)).size).toBe(4);
      expect(question.questionLines.join(" ")).toBe(question.question);
      expect(question.why.length).toBeGreaterThan(10);
      question.options.forEach((option) => expect(option.description.length).toBeGreaterThan(5));
    });
  });

  it("removes unknown question and answer values", () => {
    expect(sanitizeAnswers({ business: "cafe", demand: "invalid", unknown: "x" })).toEqual({ business: "cafe" });
  });

  it("builds a transparent result title from selected axes", () => {
    expect(profileTitle({ demand: "neighborhood", operation: "solo" })).toBe("동네 단골을 차근차근 만드는 1인 운영형");
  });

  it("splits the result title at a natural reading point", () => {
    expect(profileTitleLines({ demand: "office", operation: "partner" })).toEqual([
      "직장인의 일상에",
      "들어가는 함께 운영형",
    ]);
  });
});
