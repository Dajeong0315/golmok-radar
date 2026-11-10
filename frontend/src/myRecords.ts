import type { AccountRecord } from "./accountStore";
import type { PropertyWorksheet } from "./propertyWorksheet";

export type FavoriteExport = { code: string; name: string | null };

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesQuery(parts: Array<string | undefined | null>, query: string): boolean {
  const needle = normalizeQuery(query);
  if (!needle) return true;
  return parts.some((part) => (part || "").toLowerCase().includes(needle));
}

/** 제목과 태그로 계정 기록을 찾습니다. 태그를 고르면 그 태그가 붙은 기록만 남깁니다. */
export function filterAccountRecords(records: AccountRecord[], query: string, tag: string): AccountRecord[] {
  return records.filter((record) =>
    (!tag || (record.tags || []).includes(tag)) && includesQuery([record.title, ...(record.tags || [])], query));
}

export function filterFavorites(codes: string[], names: Record<string, string>, query: string): string[] {
  return codes.filter((code) => includesQuery([code, names[code]], query));
}

export function filterWorksheets(worksheets: PropertyWorksheet[], query: string): PropertyWorksheet[] {
  return worksheets.filter((worksheet) => includesQuery([worksheet.alias, worksheet.locationDescription], query));
}

export function collectTags(records: AccountRecord[]): string[] {
  return [...new Set(records.flatMap((record) => record.tags || []))].sort((left, right) => left.localeCompare(right, "ko"));
}

export function tagsSupported(records: AccountRecord[]): boolean {
  return records.every((record) => record.tags !== undefined);
}

/** 본인 기록 내보내기 파일 내용. 계정 식별자·이메일은 넣지 않습니다. */
export function buildAccountExport(input: {
  records: AccountRecord[];
  favorites: string[];
  areaNames: Record<string, string>;
  worksheets: PropertyWorksheet[];
  exportedAt: Date;
}) {
  return {
    format: "golmok-radar-account-export",
    version: 1,
    exported_at: input.exportedAt.toISOString(),
    notice: "골목 레이더 계정에 저장된 내 기록 사본입니다. 공식 통계 값은 저장 당시 기준분기의 값이며 이후 갱신되지 않습니다.",
    records: input.records.map((record) => ({
      kind: record.kind,
      title: record.title,
      tags: record.tags || [],
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      schema_version: record.schemaVersion,
      payload: record.payload,
    })),
    favorite_trade_areas: input.favorites.map((code): FavoriteExport => ({ code, name: input.areaNames[code] || null })),
    property_worksheets: input.worksheets,
  };
}

export function exportFileName(date: Date): string {
  const local = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  return `golmok-radar-records-${local}.json`;
}
