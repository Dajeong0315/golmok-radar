import type { AreaMapInsightResponse, AreaReportResponse, AreaReviewReport, CapturedReviewReport, ChecklistResponse, ComparisonExportResponse, ComparisonResponse, EvidenceResponse, IndustryOption, QuarterListResponse, RecommendationResponse, RentBenchmarkResponse, RentMarketListResponse, ReviewAnalysisResponse, ReviewAreaLocation, ReviewCaptureStatus, ReviewIndustryMapping, SupportProgramResponse, TradeArea } from "./types";


export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/** 기준분기가 비어 있으면 쿼리에서 빼서 서버의 기본 분기(가장 최근 적재 분기)를 쓰게 합니다. */
function withQuarter(params: Record<string, string>, quarter?: string): URLSearchParams {
  return new URLSearchParams(quarter ? { ...params, quarter } : params);
}

export async function fetchQuarters(signal?: AbortSignal): Promise<QuarterListResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/quarters`, { signal });
  if (!response.ok) throw new Error("기준분기 정보를 불러오지 못했습니다.");
  return response.json() as Promise<QuarterListResponse>;
}

export async function fetchTradeAreas(industry = "CS100010", signal?: AbortSignal, quarter?: string): Promise<TradeArea[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas?${withQuarter({ industry }, quarter)}`, { signal });
  if (!response.ok) {
    throw new Error("상권 정보를 불러오지 못했습니다.");
  }
  return response.json() as Promise<TradeArea[]>;
}

export async function fetchIndustries(signal?: AbortSignal, quarter?: string): Promise<IndustryOption[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/industries?${withQuarter({}, quarter)}`, { signal });
  if (!response.ok) throw new Error("업종 정보를 불러오지 못했습니다.");
  return response.json() as Promise<IndustryOption[]>;
}

export async function fetchComparison(codes: string[], industry = "CS100010", signal?: AbortSignal, quarter?: string): Promise<ComparisonResponse> {
  const query = withQuarter({ codes: codes.join(","), industry }, quarter);
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

export async function fetchComparisonExport(comparisonId: string, signal?: AbortSignal): Promise<ComparisonExportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/comparisons/${comparisonId}/export`, { signal });
  if (!response.ok) throw new Error("리포트 내용을 불러오지 못했습니다.");
  return response.json() as Promise<ComparisonExportResponse>;
}

export async function fetchChecklist(signal?: AbortSignal): Promise<ChecklistResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/field-checklist`, { signal });
  if (!response.ok) throw new Error("현장 질문을 불러오지 못했습니다.");
  return response.json() as Promise<ChecklistResponse>;
}

export async function fetchRecommendations(answers: Record<string, string>, industry = "CS100010", signal?: AbortSignal): Promise<RecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...answers, industry_code: industry }),
    signal,
  });
  if (!response.ok) throw new Error("후보 상권을 계산하지 못했습니다.");
  return response.json() as Promise<RecommendationResponse>;
}

export async function fetchAreaReport(code: string, industry = "CS100010", signal?: AbortSignal, quarter?: string): Promise<AreaReportResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/trade-areas/${code}/report?${withQuarter({ industry }, quarter)}`, { signal });
  if (!response.ok) throw new Error("상권 리포트를 불러오지 못했습니다.");
  return response.json() as Promise<AreaReportResponse>;
}

export async function fetchAreaMapInsight(code: string, industry = "CS100010", signal?: AbortSignal, quarter?: string): Promise<AreaMapInsightResponse> {
  const query = withQuarter({ industry }, quarter);
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

export async function fetchReviewCaptureStatus(signal?: AbortSignal): Promise<ReviewCaptureStatus> {
  const response = await fetch(`${API_BASE_URL}/api/v1/review-capture-status`, { signal });
  if (!response.ok) throw new Error("리뷰 수집 상태를 불러오지 못했습니다.");
  return response.json() as Promise<ReviewCaptureStatus>;
}

export type ReviewPlaceInput = { id: string; latitude: number; longitude: number; name: string; category: string };

export async function fetchReviewIndustryMapping(code: string, signal?: AbortSignal): Promise<ReviewIndustryMapping> {
  const response = await fetch(`${API_BASE_URL}/api/v1/review-industry/${encodeURIComponent(code)}`, { signal });
  if (!response.ok) throw new Error("업종별 장소 분류를 불러오지 못했습니다.");
  return response.json() as Promise<ReviewIndustryMapping>;
}

export async function fetchReviewTradeArea(place: ReviewPlaceInput, signal?: AbortSignal): Promise<ReviewAreaLocation> {
  const query = new URLSearchParams({ latitude: String(place.latitude), longitude: String(place.longitude) });
  const response = await fetch(`${API_BASE_URL}/api/v1/review-trade-area?${query}`, { signal });
  if (!response.ok) throw new Error("가게 위치의 공식 상권을 확인하지 못했습니다.");
  return response.json() as Promise<ReviewAreaLocation>;
}

export async function fetchCapturedReviewReport(
  own: ReviewPlaceInput,
  candidates: ReviewPlaceInput[],
  accessToken: string,
  ownershipConfirmed: boolean,
  industryCode: string,
): Promise<CapturedReviewReport> {
  const response = await fetch(`${API_BASE_URL}/api/v1/captured-review-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ own, candidates, ownership_confirmed: ownershipConfirmed, industry_code: industryCode }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || "리뷰 수집과 비교를 완료하지 못했습니다.");
  }
  return response.json() as Promise<CapturedReviewReport>;
}

export async function fetchAreaReviewReport(
  areaCode: string, industryCode: string, candidates: ReviewPlaceInput[], accessToken: string,
): Promise<AreaReviewReport> {
  const response = await fetch(`${API_BASE_URL}/api/v1/area-review-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ trade_area_code: areaCode, industry_code: industryCode, candidates }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail || "상권 리뷰 표본을 불러오지 못했습니다.");
  }
  return response.json() as Promise<AreaReviewReport>;
}

