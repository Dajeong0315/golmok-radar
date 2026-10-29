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

