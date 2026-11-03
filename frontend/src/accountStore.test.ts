import { describe, expect, it } from "vitest";

import { mergeWorksheets, transferAnonymousRecords } from "./accountStore";
import { DRAFT_KEY, PROFILE_KEY, PROFILE_VERSION } from "./founderProfile";
import { FAVORITES_KEY } from "./favorites";
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

  it("uploads every valid anonymous record with an idempotent transfer batch", async () => {
    const calls: Array<{ table: string; value: Record<string, unknown> }> = [];
    const client = { from: (table: string) => ({ upsert: async (value: Record<string, unknown>) => { calls.push({ table, value }); return { error: null }; } }) } as never;
    await transferAnonymousRecords(client, "user-a", {
      schemaVersion: 1,
      batchId: "transfer-one",
      createdAt: 1,
      protectedUntil: 2,
      returnHash: "#explore",
      userId: "user-a",
      records: {
        [FAVORITES_KEY]: '["3120052","3120052"]',
        [PROFILE_KEY]: JSON.stringify({ version: PROFILE_VERSION, completedAt: "2026-11-03T00:00:00.000Z", answers: { business: "cafe", demand: "office", risk: "lean", operation: "solo", strength: "numbers", competition: "avoid" } }),
        [DRAFT_KEY]: JSON.stringify({ business: "cafe" }),
      },
    });
    expect(calls.filter((call) => call.table === "user_favorites")).toHaveLength(1);
    expect(calls.filter((call) => call.table === "user_records").map((call) => call.value.record_id)).toEqual([
      "transfer-one:founder-profile", "transfer-one:founder-draft",
    ]);
    expect(calls.every((call) => call.value.user_id === "user-a")).toBe(true);
  });
});
