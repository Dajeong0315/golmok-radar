import { readdirSync } from "node:fs";
import { dirname, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Windows·macOS는 파일 이름의 대소문자를 구분하지 않습니다. `./ComparisonQuiz`처럼 확장자 없이 불러올 때
// `ComparisonQuiz.tsx`와 `comparisonQuiz.ts`가 함께 있으면 엉뚱한 파일을 집어 화면이 깨집니다.
describe("source file names", () => {
  it("has no TypeScript modules whose names differ only by letter case", () => {
    const sources = readdirSync(dirname(fileURLToPath(import.meta.url))).filter((name) => /\.(ts|tsx)$/.test(name));
    const byLowerName = new Map<string, Set<string>>();
    for (const file of sources) {
      const stem = parse(file).name.replace(/\.test$/, "");
      const key = stem.toLowerCase();
      byLowerName.set(key, (byLowerName.get(key) ?? new Set()).add(stem));
    }
    const clashes = [...byLowerName.values()].filter((names) => names.size > 1).map((names) => [...names].join(" / "));
    expect(clashes).toEqual([]);
  });
});
