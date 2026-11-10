import { describe, expect, it } from "vitest";

import { fetchAccountRecords, isMissingTagsColumn, normalizeTags, type AccountRecord } from "./accountStore";
import { buildAccountExport, collectTags, exportFileName, filterAccountRecords, filterFavorites, tagsSupported } from "./myRecords";

const record = (title: string, tags?: string[], kind: AccountRecord["kind"] = "founder_profile"): AccountRecord => ({
  recordId: title, kind, title, payload: { secret: false }, schemaVersion: 1,
  createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z", tags,
});

describe("tags", () => {
  it("trims, dedupes and limits tags", () => {
    expect(normalizeTags(" 성수 , 성수,  1차   후보 ,,")).toEqual(["성수", "1차 후보"]);
    expect(normalizeTags(["a", "b", "c", "d", "e", "f"])).toHaveLength(5);
    expect(normalizeTags("가".repeat(30))[0]).toHaveLength(20);
    expect(normalizeTags(null)).toEqual([]);
  });

  it("recognizes the error from a database without the tags column", () => {
    expect(isMissingTagsColumn({ code: "42703", message: "column user_records.tags does not exist" })).toBe(true);
    expect(isMissingTagsColumn({ code: "PGRST204", message: "Could not find the 'tags' column" })).toBe(true);
    expect(isMissingTagsColumn({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingTagsColumn(null)).toBe(false);
  });
});

describe("record search and filters", () => {
  const records = [record("성수 1차 후보", ["성수", "카페"]), record("건대 후보", ["카페"]), record("리뷰 점검", [], "review_report")];

  it("matches titles and tags case-insensitively and narrows by tag", () => {
    expect(filterAccountRecords(records, "성수", "").map((item) => item.title)).toEqual(["성수 1차 후보"]);
    expect(filterAccountRecords(records, "카페", "").map((item) => item.title)).toEqual(["성수 1차 후보", "건대 후보"]);
    expect(filterAccountRecords(records, "", "성수").map((item) => item.title)).toEqual(["성수 1차 후보"]);
    expect(filterAccountRecords(records, "건대", "성수")).toEqual([]);
    expect(filterAccountRecords(records, "  ", "")).toHaveLength(3);
  });

  it("finds favorites by area name or code", () => {
    expect(filterFavorites(["3120052", "3120053"], { "3120052": "성수역" }, "성수")).toEqual(["3120052"]);
    expect(filterFavorites(["3120052", "3120053"], {}, "3120053")).toEqual(["3120053"]);
  });

  it("lists tags and knows when the database cannot store them", () => {
    expect(collectTags(records)).toEqual(["성수", "카페"]);
    expect(tagsSupported(records)).toBe(true);
    expect(tagsSupported([record("이전 DB")])).toBe(false);
  });
});

describe("account export", () => {
  it("keeps the user's own records without account identifiers", () => {
    const content = buildAccountExport({
      records: [record("성수 1차 후보", ["성수"])], favorites: ["3120052"], areaNames: { "3120052": "성수역" },
      worksheets: [], exportedAt: new Date("2026-11-10T15:30:00Z"),
    });
    expect(content.records[0]).toMatchObject({ kind: "founder_profile", title: "성수 1차 후보", tags: ["성수"], payload: { secret: false } });
    expect(content.favorite_trade_areas).toEqual([{ code: "3120052", name: "성수역" }]);
    expect(JSON.stringify(content)).not.toMatch(/user_id|userId|email|recordId/);
    expect(exportFileName(new Date("2026-11-10T15:30:00Z"))).toBe("golmok-radar-records-20261111.json");
  });
});

describe("fetchAccountRecords", () => {
  function fakeClient(responses: Array<{ data: unknown; error: unknown }>, selects: string[]) {
    const builder = (columns: string) => {
      selects.push(columns);
      const response = responses.shift();
      const chain = { eq: () => chain, order: () => chain, then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve) };
      return chain;
    };
    return { from: () => ({ select: builder }) } as never;
  }

  const row = { record_id: "r1", kind: "founder_profile", title: "결과", payload: {}, schema_version: 1, created_at: "c", updated_at: "u", source_batch_id: null };

  it("reads tags when the column exists", async () => {
    const selects: string[] = [];
    const result = await fetchAccountRecords(fakeClient([{ data: [{ ...row, tags: ["성수", "성수"] }], error: null }], selects), "user");
    expect(selects[0]).toContain("tags");
    expect(result[0].tags).toEqual(["성수"]);
  });

  it("falls back without tags before the migration is applied", async () => {
    const selects: string[] = [];
    const result = await fetchAccountRecords(fakeClient([
      { data: null, error: { code: "42703", message: "column user_records.tags does not exist" } },
      { data: [row], error: null },
    ], selects), "user");
    expect(selects).toHaveLength(2);
    expect(selects[1]).not.toContain("tags");
    expect(result[0].tags).toBeUndefined();
  });

  it("still surfaces other errors", async () => {
    await expect(fetchAccountRecords(fakeClient([{ data: null, error: { code: "42501", message: "permission denied" } }], []), "user")).rejects.toThrow("permission denied");
  });
});

describe("saveAccountRecord", () => {
  it("sends tags only when the record has them", async () => {
    const { saveAccountRecord } = await import("./accountStore");
    const sent: Record<string, unknown>[] = [];
    const client = { from: () => ({ upsert: async (row: Record<string, unknown>) => { sent.push(row); return { error: null }; } }) } as never;
    await saveAccountRecord(client, "user", record("이전 DB"));
    await saveAccountRecord(client, "user", record("태그", [" 성수 ", "성수"]));
    expect("tags" in sent[0]).toBe(false);
    expect(sent[1].tags).toEqual(["성수"]);
  });
});
