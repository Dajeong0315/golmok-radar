import type { AreaReportResponse, ChecklistResponse, ComparisonResponse, EvidenceResponse, RecommendationResponse, TradeArea } from "./types";


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

export async function fetchEvidence(comparisonId: string, metricKey: string, signal?: AbortSignal): Promise<EvidenceResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/comparisons/${comparisonId}/evidence/${metricKey}`, { signal });
  if (!response.ok) throw new Error("지표 근거를 불러오지 못했습니다.");
  return response.json() as Promise<EvidenceResponse>;
}

export async function fetchChecklist(signal?: AbortSignal): Promise<ChecklistResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/field-checklist`, { signal });
  if (!response.ok) throw new Error("현장 질문을 불러오지 못했습니다.");
  return response.json() as Promise<ChecklistResponse>;
}

export async function fetchRecommendations(answers: Record<string, string>, signal?: AbortSignal): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
    signal,
  });
  if (!response.ok) throw new Error("후보 상권을 계산하지 못했습니다.");
  return response.json() as Promise<RecommendationResponse>;
}

export async function fetchAreaReport(code: string, signal?: AbortSignal): Promise<AreaReportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas/${code}/report?quarter=20254`, { signal });
  if (!response.ok) throw new Error("상권 리포트를 불러오지 못했습니다.");
  return response.json() as Promise<AreaReportResponse>;
}

