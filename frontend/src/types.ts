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

