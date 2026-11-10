import { describe, expect, it } from "vitest";

import { buildCardModel, cardFileName, CARD_METRICS, formatCardValue } from "./comparisonCard";
import { buildQuiz, guessFeedback } from "./comparisonQuiz";
import type { ComparisonMetric, ComparisonResponse, TradeArea } from "./types";

const area = (code: string, name: string): TradeArea => ({
  code, name, district_name: "성동구", area_type_name: "발달상권", latitude: 37.5, longitude: 127,
  data_status: { store: true, sales: true, population: true },
});
const metric = (key: string, label: string, unit: string, values: Array<number | null>): ComparisonMetric => ({
  metric_key: key, label, unit,
  values: values.map((value, index) => ({ trade_area_code: String(index + 1), status: value === null ? "unavailable" : "available", value, reason: value === null ? "원천 행이 없습니다." : null })),
});
const comparison = (metrics: ComparisonMetric[]): ComparisonResponse => ({
  comparison_id: "20254--1-2-3", quarter_code: "20254", quarter_label: "2025년 4분기", industry_code: "CS100010", industry_name: "커피-음료",
  trade_areas: [area("1", "성수역"), area("2", "건대입구역"), area("3", "성수동카페거리")], metrics,
});

describe("comparison quiz", () => {
  const data = comparison([
    metric("store_count", "커피-음료 점포 수", "개", [56, 88, 40]),
    metric("total_population", "추정 유동인구", "명", [1000, null, 300]),
    metric("weekend_sales_ratio", "주말 매출 비중", "%", [25.7, 35.2, 35.2]),
    metric("sales_amount", "커피-음료 추정매출", "원", [1, 2, 3]),
  ]);
  const quiz = buildQuiz(data);

  it("asks the first area's official store count", () => {
    const guess = quiz.find((question) => question.kind === "guess");
    expect(guess).toMatchObject({ prompt: "성수역에 커피-음료 점포는 몇 개일까요?", answer: 56, answerText: "56 개" });
  });

  it("only asks which area is highest when every value exists and there is no tie", () => {
    expect(quiz.filter((question) => question.kind === "pick").map((question) => question.metricKey)).toEqual(["store_count"]);
    const pick = quiz.find((question) => question.kind === "pick");
    expect(pick && pick.kind === "pick" && pick.answerCode).toBe("2");
    expect(pick && pick.kind === "pick" && pick.explanation).toBe("성수역 56 개 · 건대입구역 88 개 · 성수동카페거리 40 개");
  });

  it("builds no question from missing values", () => {
    const empty = comparison([metric("store_count", "커피-음료 점포 수", "개", [null, 88, 40])]);
    expect(buildQuiz(empty).find((question) => question.kind === "guess")).toBeUndefined();
    expect(buildQuiz(empty).filter((question) => question.kind === "pick")).toHaveLength(0);
  });

  it("reports the official value and the gap", () => {
    const guess = quiz.find((question) => question.kind === "guess");
    if (!guess || guess.kind !== "guess") throw new Error("문제가 없습니다");
    expect(guessFeedback(guess, 56)).toBe("정확해요! 공식 값은 56 개입니다.");
    expect(guessFeedback(guess, 70)).toBe("공식 값은 56 개로, 입력한 값과 14개 차이가 나요.");
  });
});

describe("comparison card", () => {
  const data = comparison([
    metric("store_count", "커피-음료 점포 수", "개", [56, 88, 40]),
    metric("sales_amount", "커피-음료 추정매출", "원", [3517833204, null, 1518480285]),
    metric("total_population", "추정 유동인구", "명", [null, null, null]),
    metric("weekend_sales_ratio", "주말 매출 비중", "%", [25.7, 35.2, 30.9]),
    metric("closing_rate", "폐업률", "%", [9, 5, 2]),
  ]);
  const model = buildCardModel(data);

  it("shows four fixed metrics in order with source values only", () => {
    expect(CARD_METRICS).toHaveLength(4);
    expect(model.rows.map((row) => row.label)).toEqual(["커피-음료 점포 수", "커피-음료 추정매출", "추정 유동인구", "주말 매출 비중"]);
    expect(model.rows[1].values).toEqual(["35.2억 원", "비교 불가", "15.2억 원"]);
    expect(model.footer.join(" ")).toContain("억 원 값은 소수 첫째 자리로 반올림했습니다");
    expect(model.rows[2].values).toEqual(["비교 불가", "비교 불가", "비교 불가"]);
    expect(model.areas.map((item) => item.name)).toEqual(["성수역", "건대입구역", "성수동카페거리"]);
  });

  it("names the source and quarter and makes no judgment", () => {
    expect(model.subtitle).toBe("커피-음료 · 2025년 4분기");
    expect(model.footer[0]).toContain("기준분기 2025년 4분기 (20254)");
    expect(model.footer.join(" ")).toContain("추천이 아닙니다");
    const text = JSON.stringify(model);
    expect(text).not.toMatch(/승|패|우세|1위|등급|점수|이길|추천 상권/);
    expect(cardFileName(new Date("2026-11-10T15:30:00Z"))).toBe("golmok-radar-card-20261111.png");
  });

  it("keeps small amounts exact and adds the rounding note only when needed", () => {
    expect(formatCardValue(99_999_999, "원")).toBe("99,999,999 원");
    expect(formatCardValue(7_650_408_649, "원")).toBe("76.5억 원");
    expect(formatCardValue(56, "개")).toBe("56 개");
    const small = buildCardModel(comparison([metric("store_count", "커피-음료 점포 수", "개", [56, 88, 40])]));
    expect(small.footer.join(" ")).not.toContain("억 원");
  });
});
