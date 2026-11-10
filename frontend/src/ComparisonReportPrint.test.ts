import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComparisonReportPrint } from "./ComparisonReportPrint";
import type { ComparisonExportResponse, TradeArea } from "./types";

const area = (code: string, name: string): TradeArea => ({
  code, name, district_name: "성동구", area_type_name: "발달상권", latitude: 37.5, longitude: 127,
  data_status: { store: true, sales: true, population: false },
});

const REPORT: ComparisonExportResponse = {
  comparison: {
    comparison_id: "20254--3120052-3120053", quarter_code: "20254", quarter_label: "2025년 4분기",
    industry_code: "CS100010", industry_name: "커피-음료",
    trade_areas: [area("3120052", "성수역"), area("3120053", "건대입구역(건대)")],
    metrics: [
      { metric_key: "sales_11_14_ratio", label: "11~14시 매출 비중", unit: "%", values: [
        { trade_area_code: "3120052", status: "available", value: 33.1, reason: null },
        { trade_area_code: "3120053", status: "available", value: 22.6, reason: null },
      ] },
      { metric_key: "total_population", label: "추정 유동인구", unit: "명", values: [
        { trade_area_code: "3120052", status: "unavailable", value: null, reason: "해당 분기의 유동인구 원천 행이 없습니다." },
        { trade_area_code: "3120053", status: "unavailable", value: null, reason: "해당 분기의 유동인구 원천 행이 없습니다." },
      ] },
    ],
  },
  evidence: [
    { metric_key: "sales_11_14_ratio", label: "11~14시 매출 비중", unit: "%", dataset_name: "서울시 상권분석서비스(추정매출-상권)",
      provider: "서울신용보증재단", source_file: "추정매출_2025년.zip", fetched_at: null, quarter_code: "20254",
      industry_code: "CS100010", industry_name: "커피-음료", formula: "시간대 매출 금액 ÷ 전체 매출 금액 × 100",
      rounding: "소수 첫째 자리, ROUND_HALF_UP", areas: [
        { trade_area_code: "3120052", trade_area_name: "성수역", status: "available", value: 33.1, reason: null,
          filter: { quarter_code: "20254", trade_area_code: "3120052", industry_code: "CS100010" }, numerator: 1163808652, denominator: 3517833204 },
      ] },
    { metric_key: "total_population", label: "추정 유동인구", unit: "명", dataset_name: "길단위인구", provider: "서울신용보증재단",
      source_file: "pop.csv", fetched_at: "2026-10-29T10:00:00", quarter_code: "20254", industry_code: "CS100010",
      industry_name: "커피-음료", formula: null, rounding: null, areas: [
        { trade_area_code: "3120052", trade_area_name: "성수역", status: "unavailable", value: null,
          reason: "해당 분기의 유동인구 원천 행이 없습니다.", filter: { quarter_code: "20254" }, numerator: null, denominator: null },
      ] },
  ],
  generated_at: "2026-11-10T01:00:00+00:00",
  limitations: ["이 리포트는 상권을 추천하거나 창업 성공 가능성을 판단하지 않습니다."],
};

describe("printable comparison report", () => {
  const html = renderToStaticMarkup(createElement(ComparisonReportPrint, { report: REPORT }));

  it("shows the scope: industry, quarter, generation time and every area", () => {
    expect(html).toContain("커피-음료 (CS100010)");
    expect(html).toContain("2025년 4분기 (20254)");
    expect(html).toContain("2026. 11. 10.");
    expect(html).toContain("상권 코드 3120052");
    expect(html).toContain("건대입구역(건대)");
  });

  it("prints backend values as they are and keeps unavailable reasons", () => {
    expect(html).toContain("33.1%");
    expect(html).toContain("22.6%");
    expect(html).toContain("해당 분기의 유동인구 원천 행이 없습니다.");
    expect(html).not.toMatch(/>0 명</);
  });

  it("includes source, formula, rounding, numerator, denominator and filter for each metric", () => {
    expect(html).toContain("서울시 상권분석서비스(추정매출-상권) · 서울신용보증재단 · 원천 파일 추정매출_2025년.zip");
    expect(html).toContain("시간대 매출 금액 ÷ 전체 매출 금액 × 100");
    expect(html).toContain("ROUND_HALF_UP");
    expect(html).toContain("1,163,808,652");
    expect(html).toContain("3,517,833,204");
    expect(html).toContain("<span>industry_code=CS100010</span>");
    expect(html).toContain("원천값 그대로 사용");
    expect(html).toContain("수집 2026-10-29");
  });

  it("states the limits and adds no recommendation, score or share link", () => {
    expect(html).toContain("추천하거나 창업 성공 가능성을 판단하지 않습니다");
    expect(html).not.toMatch(/공유|추천 점수|등급|https?:\/\//);
  });
});
