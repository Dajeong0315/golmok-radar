import type { AreaMapInsightResponse, AreaReportResponse, ChecklistResponse, ComparisonResponse, EvidenceResponse, IndustryOption, RecommendationResponse, RentBenchmarkResponse, RentMarketListResponse, ReviewAnalysisResponse, SupportProgramResponse, TradeArea } from "./types";


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function fetchTradeAreas(industry = "CS100010", signal?: AbortSignal): Promise<TradeArea[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas?${new URLSearchParams({ industry })}`, { signal });
  if (!response.ok) {
    throw new Error("상권 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<TradeArea[]>;
}

export async function fetchIndustries(signal?: AbortSignal): Promise<IndustryOption[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/industries?quarter=20254`, { signal });
  if (!response.ok) throw new Error("업종 정보를 불러오지 못했습니다.");
  return response.json() as Promise<IndustryOption[]>;
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

export async function fetchAreaMapInsight(code: string, industry = "CS100010", signal?: AbortSignal): Promise<AreaMapInsightResponse> {
  const query = new URLSearchParams({ quarter: "20254", industry });
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas/${code}/map-insight?${query}`, { signal });
  if (!response.ok) throw new Error("상권 지도 근거를 불러오지 못했습니다.");
  return response.json() as Promise<AreaMapInsightResponse>;
}

export async function fetchRentMarkets(signal?: AbortSignal): Promise<RentMarketListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/rent-markets`, { signal });
  if (!response.ok) throw new Error("공식 임대 조사상권 목록을 불러오지 못했습니다.");
  return response.json() as Promise<RentMarketListResponse>;
}

export async function fetchRentBenchmark(code: string, marketCode?: string, signal?: AbortSignal): Promise<RentBenchmarkResponse> {
  const query = marketCode ? `?${new URLSearchParams({ market_code: marketCode })}` : "";
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas/${code}/rent-benchmark${query}`, { signal });
  if (!response.ok) throw new Error("임대 벤치마크 상태를 불러오지 못했습니다.");
  return response.json() as Promise<RentBenchmarkResponse>;
}

export async function fetchSupportPrograms(profile: {
  stage: "pre_startup" | "existing";
  region: string;
  age?: number;
  years_in_business?: number;
}, signal?: AbortSignal): Promise<SupportProgramResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/support-programs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
    signal,
  });
  if (!response.ok) throw new Error("지원사업 연동 상태를 확인하지 못했습니다.");
  return response.json() as Promise<SupportProgramResponse>;
}

export async function analyzeReviewText(payload: {
  own_shop_name: string;
  comparison_scope: string;
  period_label: string;
  ownership_confirmed: boolean;
  data_rights_confirmed: boolean;
  own_reviews: string[];
  nearby_reviews: string[];
}): Promise<ReviewAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/review-analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("리뷰 분석을 완료하지 못했습니다.");
  return response.json() as Promise<ReviewAnalysisResponse>;
}

