export const METRIC_GROUPS = [
  { title: "점포", keys: ["store_count", "opening_rate", "closing_rate"] },
  { title: "매출", keys: ["sales_amount", "weekday_sales_ratio", "weekend_sales_ratio", "average_payment"] },
  { title: "시간대별 매출", keys: ["sales_00_06_ratio", "sales_06_11_ratio", "sales_11_14_ratio", "sales_14_17_ratio", "sales_17_21_ratio", "sales_21_24_ratio"] },
  { title: "유동인구", keys: ["total_population", "population_00_06_ratio", "population_06_11_ratio", "population_11_14_ratio", "population_14_17_ratio", "population_17_21_ratio", "population_21_24_ratio"] },
] as const;

export function parseComparisonCodes(hash: string): string[] {
  const query = hash.split("?")[1] || "";
  return (new URLSearchParams(query).get("codes") || "")
    .split(",")
    .map((code) => code.trim())
    .filter((code, index, all) => Boolean(code) && all.indexOf(code) === index)
    .slice(0, 4);
}

export function formatMetricValue(value: number | null, unit: string): string {
  if (value === null) return "비교 불가";
  if (unit === "%") return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
  return `${value.toLocaleString("ko-KR")} ${unit}`;
}
