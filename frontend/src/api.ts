import type { ComparisonResponse, TradeArea } from "./types";


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchTradeAreas(signal?: AbortSignal): Promise<TradeArea[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas`, { signal });
  if (!response.ok) {
    throw new Error("상권 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<TradeArea[]>;
}

export async function fetchComparison(codes: string[], signal?: AbortSignal): Promise<ComparisonResponse> {
  const query = new URLSearchParams({ codes: codes.join(","), quarter: "20254" });
  const response = await fetch(`${API_BASE_URL}/api/v1/comparisons?${query}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || "비교 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<ComparisonResponse>;
}

