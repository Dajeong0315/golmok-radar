import { describe, expect, it } from "vitest";

import { mergeWorksheets } from "./accountStore";
import { createWorksheet } from "./propertyWorksheet";

describe("account worksheet merge", () => {
  it("keeps the most recently edited copy of a worksheet and preserves separate records", () => {
    const remote = { ...createWorksheet("same"), alias: "서버 기록", updatedAt: "2026-11-02T01:00:00.000Z" };
    const local = { ...createWorksheet("same"), alias: "내 브라우저 기록", updatedAt: "2026-11-02T02:00:00.000Z" };
    const separate = { ...createWorksheet("new"), alias: "별도 후보", updatedAt: "2026-11-02T00:00:00.000Z" };
    expect(mergeWorksheets([local, separate], [remote])).toMatchObject([
      { id: "same", alias: "내 브라우저 기록" },
      { id: "new", alias: "별도 후보" },
    ]);
  });
});
