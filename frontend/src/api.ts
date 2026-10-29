import type { TradeArea } from "./types";


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchTradeAreas(signal?: AbortSignal): Promise<TradeArea[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas`, { signal });
  if (!response.ok) {
    throw new Error("상권 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<TradeArea[]>;
}

