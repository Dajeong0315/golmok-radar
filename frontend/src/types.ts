export type DataStatus = {
  store: boolean;
  sales: boolean;
  population: boolean;
};

export type TradeArea = {
  code: string;
  name: string;
  district_name: string;
  area_type_name: string;
  latitude: number;
  longitude: number;
  data_status: DataStatus;
};

export type MetricAreaValue = {
  trade_area_code: string;
  status: "available" | "unavailable";
  value: number | null;
  reason: string | null;
};

export type ComparisonMetric = {
  metric_key: string;
  label: string;
  unit: string;
  values: MetricAreaValue[];
};

export type ComparisonResponse = {
  comparison_id: string;
  quarter_code: string;
  quarter_label: string;
  trade_areas: TradeArea[];
  metrics: ComparisonMetric[];
};

export type EvidenceArea = {
  trade_area_code: string;
  trade_area_name: string;
  status: "available" | "unavailable";
  value: number | null;
  reason: string | null;
  filter: Record<string, string>;
  numerator: number | null;
  denominator: number | null;
};

export type EvidenceResponse = {
  metric_key: string;
  label: string;
  unit: string;
  dataset_name: string;
  provider: string;
  source_file: string;
  fetched_at: string | null;
  quarter_code: string;
  formula: string | null;
  rounding: string | null;
  areas: EvidenceArea[];
};

export type ChecklistResponse = {
  notice: string;
  items: Array<{ category: string; question: string }>;
};

export type RecommendationReason = {
  metric_key: string;
  label: string;
  unit: string;
  value: number;
  percentile: number;
  fit_percentile: number;
  weight: number;
  direction: "higher" | "lower";
  explanation: string;
};

export type RecommendationCandidate = {
  rank: number;
  score: number;
  trade_area: TradeArea;
  reasons: RecommendationReason[];
  cautions: string[];
  data_completeness: string;
};

export type RecommendationResponse = {
  status: "available" | "unsupported_business";
  message: string;
  quarter_code: string;
  quarter_label: string;
  weights_version: string;
  candidate_pool_size: number;
  diversity_rule: string;
  candidates: RecommendationCandidate[];
};

export type AreaReportInsight = {
  metric_key: string;
  label: string;
  value: number | null;
  unit: string;
  percentile: number | null;
  summary: string;
};

export type AreaReportResponse = {
  quarter_code: string;
  quarter_label: string;
  comparison_count: number;
  trade_area: TradeArea;
  strengths: AreaReportInsight[];
  cautions: AreaReportInsight[];
  characteristics: AreaReportInsight[];
  notice: string;
};

export type RentBenchmarkResponse = {
  status: "available" | "mapping_required";
  trade_area: TradeArea;
  provider: string;
  dataset_name: string;
  update_cycle: string;
  is_live_listing: boolean;
  source_period: string | null;
  source_region: string | null;
  building_type: string | null;
  mapping_scope: "administrative_context" | null;
  confidence: "contextual" | null;
  metrics: Array<{
    metric_key: string;
    label: string;
    value: number;
    unit: string;
    table_id: string;
    item_id: string;
  }>;
  message: string;
  disclaimer: string;
  source_url: string;
  api_docs_url: string;
};

export type SupportProgramCandidate = {
  program_id: string;
  title: string;
  application_start: string;
  application_end: string;
  regions: string[];
  support_type: string;
  target: string;
  source_url: string;
  reasons: string[];
  needs_confirmation: string[];
};

export type SupportProgramResponse = {
  status: "available" | "no_candidates" | "configuration_required";
  provider: string;
  checked_at: string;
  message: string;
  required_setting: string | null;
  candidates: SupportProgramCandidate[];
  source_url: string;
  disclaimer: string;
};

export type ReviewEvidence = {
  review_index: number;
  snippet: string;
  sentiment: "positive" | "negative" | "neutral";
};

export type ReviewTopicSide = {
  mentions: number;
  positive: number;
  negative: number;
  neutral: number;
  evidence: ReviewEvidence[];
};

export type ReviewAnalysisResponse = {
  status: "available" | "insufficient_sample";
  source: "user_provided";
  own_shop_name: string;
  comparison_scope: string;
  period_label: string;
  own_sample_count: number;
  nearby_sample_count: number;
  topics: Array<{ topic_key: string; label: string; own: ReviewTopicSide; nearby: ReviewTopicSide }>;
  insights: Array<{ topic_key: string; kind: "strength" | "caution"; observation: string; action_idea: string }>;
  notice: string;
};

