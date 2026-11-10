import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePropertyWorksheet, type PropertyWorksheet } from "./propertyWorksheet";
import type { AnonymousTransferSnapshot } from "./anonymousSession";
import { DRAFT_KEY, FOUNDER_QUESTIONS, PROFILE_HISTORY_KEY, PROFILE_KEY, PROFILE_VERSION, sanitizeAnswers, type FounderProfile } from "./founderProfile";
import { FAVORITES_KEY } from "./favorites";
import { PROPERTY_WORKSHEETS_KEY } from "./propertyWorksheet";

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function fetchAccountFavorites(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from("user_favorites").select("trade_area_code").eq("user_id", userId);
  raise(error);
  return (data || []).map((item) => item.trade_area_code).filter((code): code is string => typeof code === "string");
}

export async function saveAccountFavorite(client: SupabaseClient, userId: string, code: string): Promise<void> {
  const { error } = await client.from("user_favorites").upsert({ user_id: userId, trade_area_code: code }, { onConflict: "user_id,trade_area_code" });
  raise(error);
}

export async function removeAccountFavorite(client: SupabaseClient, userId: string, code: string): Promise<void> {
  const { error } = await client.from("user_favorites").delete().eq("user_id", userId).eq("trade_area_code", code);
  raise(error);
}

export async function fetchAccountWorksheets(client: SupabaseClient, userId: string): Promise<PropertyWorksheet[]> {
  const { data, error } = await client.from("property_worksheets").select("payload").eq("user_id", userId);
  raise(error);
  return (data || []).map((item) => parsePropertyWorksheet(item.payload)).filter((item): item is PropertyWorksheet => item !== null);
}

export async function saveAccountWorksheet(client: SupabaseClient, userId: string, worksheet: PropertyWorksheet): Promise<void> {
  const { error } = await client.from("property_worksheets").upsert({
    worksheet_id: worksheet.id,
    user_id: userId,
    payload: worksheet,
    updated_at: worksheet.updatedAt,
  }, { onConflict: "worksheet_id" });
  raise(error);
}

export async function removeAccountWorksheet(client: SupabaseClient, userId: string, worksheetId: string): Promise<void> {
  const { error } = await client.from("property_worksheets").delete().eq("user_id", userId).eq("worksheet_id", worksheetId);
  raise(error);
}

export function mergeWorksheets(local: PropertyWorksheet[], remote: PropertyWorksheet[]): PropertyWorksheet[] {
  const latest = new Map<string, PropertyWorksheet>();
  [...remote, ...local].forEach((worksheet) => {
    const existing = latest.get(worksheet.id);
    if (!existing || new Date(worksheet.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) latest.set(worksheet.id, worksheet);
  });
  return [...latest.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export type AccountRecord = {
  recordId: string;
  kind: "founder_profile" | "founder_draft" | "comparison_report" | "recommendation_report" | "review_report" | "area_review_report";
  title: string;
  payload: unknown;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  sourceBatchId?: string;
  /** Phase 43 태그. DB에 태그 컬럼이 없으면 undefined이며 저장할 때 보내지 않습니다. */
  tags?: string[];
};

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 20;

/** 쉼표로 나눈 입력을 태그 목록으로 정리합니다. 앞뒤 공백·중복·빈 값을 없애고 개수와 길이를 제한합니다. */
export function normalizeTags(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") continue;
    const tag = item.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

/** 태그 컬럼이 아직 없는 DB(마이그레이션 0009 적용 전)에서 나는 오류인지 확인합니다. */
export function isMissingTagsColumn(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /\btags\b/.test(error.message || "");
}

export function profileFromAccountRecord(record: AccountRecord): FounderProfile | null {
  if (record.kind !== "founder_profile" || !record.payload || typeof record.payload !== "object") return null;
  const payload = record.payload as Partial<FounderProfile>;
  const answers = sanitizeAnswers(payload.answers);
  if (payload.version !== PROFILE_VERSION || Object.keys(answers).length !== FOUNDER_QUESTIONS.length) return null;
  return { version: PROFILE_VERSION, completedAt: String(payload.completedAt || record.createdAt), answers };
}

function parseJson(value: string | undefined): unknown {
  try { return JSON.parse(value || "null"); } catch { return null; }
}

function uniqueCodes(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

type RecordRow = {
  record_id?: unknown; kind?: unknown; title?: unknown; payload?: unknown; schema_version?: unknown;
  created_at?: unknown; updated_at?: unknown; source_batch_id?: unknown; tags?: unknown;
};

const RECORD_COLUMNS = "record_id, kind, title, payload, schema_version, created_at, updated_at, source_batch_id";

export async function fetchAccountRecords(client: SupabaseClient, userId: string, kind?: AccountRecord["kind"]): Promise<AccountRecord[]> {
  const select = async (columns: string) => {
    let query = client.from("user_records").select(columns).eq("user_id", userId).order("updated_at", { ascending: false });
    if (kind) query = query.eq("kind", kind);
    return query;
  };
  let { data, error } = await select(`${RECORD_COLUMNS}, tags`);
  if (isMissingTagsColumn(error)) ({ data, error } = await select(RECORD_COLUMNS));
  raise(error);
  return ((data || []) as unknown as RecordRow[]).flatMap((row) => {
    if (!row || typeof row.record_id !== "string" || typeof row.kind !== "string" || typeof row.title !== "string") return [];
    return [{
      recordId: row.record_id,
      kind: row.kind as AccountRecord["kind"],
      title: row.title,
      payload: row.payload,
      schemaVersion: typeof row.schema_version === "number" ? row.schema_version : 1,
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
      sourceBatchId: typeof row.source_batch_id === "string" ? row.source_batch_id : undefined,
      tags: "tags" in row ? normalizeTags(row.tags) : undefined,
    }];
  });
}

export async function saveAccountRecord(client: SupabaseClient, userId: string, record: AccountRecord): Promise<void> {
  const { error } = await client.from("user_records").upsert({
    record_id: record.recordId,
    user_id: userId,
    kind: record.kind,
    title: record.title,
    payload: record.payload,
    schema_version: record.schemaVersion,
    source_batch_id: record.sourceBatchId || null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    ...(record.tags ? { tags: normalizeTags(record.tags) } : {}),
  }, { onConflict: "record_id" });
  raise(error);
}

export async function removeAccountRecord(client: SupabaseClient, userId: string, recordId: string): Promise<void> {
  const { error } = await client.from("user_records").delete().eq("user_id", userId).eq("record_id", recordId);
  raise(error);
}

/** Upload every validated item from one anonymous OAuth snapshot. It never clears local data itself. */
export async function transferAnonymousRecords(client: SupabaseClient, userId: string, snapshot: AnonymousTransferSnapshot): Promise<void> {
  const favorites = uniqueCodes(parseJson(snapshot.records[FAVORITES_KEY]));
  const worksheets = parseJson(snapshot.records[PROPERTY_WORKSHEETS_KEY]);
  const profile = parseJson(snapshot.records[PROFILE_KEY]);
  const history = parseJson(snapshot.records[PROFILE_HISTORY_KEY]);
  const draft = sanitizeAnswers(parseJson(snapshot.records[DRAFT_KEY]));
  const now = new Date().toISOString();
  await Promise.all(favorites.map((code) => saveAccountFavorite(client, userId, code)));
  if (Array.isArray(worksheets)) await Promise.all(worksheets.map(parsePropertyWorksheet).filter((item): item is PropertyWorksheet => item !== null).map((item) => saveAccountWorksheet(client, userId, item)));
  const records: AccountRecord[] = [];
  const candidates = [...(Array.isArray(history) ? history : []), profile];
  const seenProfiles = new Set<string>();
  candidates.forEach((candidate) => {
    if (!candidate || typeof candidate !== "object" || candidate.version !== PROFILE_VERSION) return;
    const answers = sanitizeAnswers(candidate.answers);
    if (Object.keys(answers).length !== FOUNDER_QUESTIONS.length) return;
    const completedAt = String(candidate.completedAt || now);
    const signature = `${completedAt}:${JSON.stringify(answers)}`;
    if (seenProfiles.has(signature)) return;
    seenProfiles.add(signature);
    const index = records.length;
    records.push({
      recordId: `${snapshot.batchId}:founder-profile${index ? `:${index}` : ""}`,
      kind: "founder_profile", title: "창업 성향 테스트 결과",
      payload: { version: PROFILE_VERSION, completedAt, answers },
      schemaVersion: PROFILE_VERSION,
      createdAt: completedAt,
      updatedAt: completedAt,
      // The database permits one record of each kind per source batch. Preserve
      // the original batch on the first result and give later result-history
      // entries deterministic child source IDs so retrying remains idempotent.
      sourceBatchId: index ? `${snapshot.batchId}:founder-profile:${index}` : snapshot.batchId,
    });
  });
  if (Object.keys(draft).length) records.push({
    recordId: `${snapshot.batchId}:founder-draft`, kind: "founder_draft", title: "작성 중인 창업 성향 테스트", payload: { version: PROFILE_VERSION, answers: draft }, schemaVersion: PROFILE_VERSION, createdAt: now, updatedAt: now, sourceBatchId: snapshot.batchId,
  });
  await Promise.all(records.map((record) => saveAccountRecord(client, userId, record)));
}
