import { describe, expect, it } from "vitest";
import { isExplorerHash, isQuizRestartHash, quizRecordId } from "./routing";

describe("home and legacy exploration links", () => {
  it.each(["", "#home", "#workflow", "#quiz", "#compare?codes=1,2"])("keeps %s out of the exploration fallback", (hash) => {
    expect(isExplorerHash(hash)).toBe(false);
  });
  it.each(["#explore", "#top", "#explorer-title", "#favorites-title"])("preserves %s exploration links", (hash) => {
    expect(isExplorerHash(hash)).toBe(true);
  });
});

describe("quiz record links", () => {
  it("returns a safe record ID from the query string", () => {
    expect(quizRecordId("#quiz?record=record-1:abc")).toBe("record-1:abc");
    expect(quizRecordId("#quiz?record=<script>")).toBeNull();
  });
});

describe("quiz restart links", () => {
  it("recognizes only an explicit restart request", () => {
    expect(isQuizRestartHash("#quiz?restart=1")).toBe(true);
    expect(isQuizRestartHash("#quiz")).toBe(false);
    expect(isQuizRestartHash("#quiz?restart=0")).toBe(false);
  });
});
