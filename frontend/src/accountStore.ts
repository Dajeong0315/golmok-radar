import type { SupabaseClient } from "@supabase/supabase-js";

import { parsePropertyWorksheet, type PropertyWorksheet } from "./propertyWorksheet";

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
