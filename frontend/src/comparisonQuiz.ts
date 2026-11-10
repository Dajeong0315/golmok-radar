import { formatMetricValue } from "./comparison";
import type { ComparisonMetric, ComparisonResponse } from "./types";

/**
 * 비교표를 보기 전에 풀어 보는 맞히기 문제 (Phase 44).
 * 정답과 보기는 모두 비교 API가 돌려준 같은 기준분기·업종의 원천값에서만 만듭니다.
 * 값이 없거나(비교 불가) 동점이면 문제를 내지 않습니다.
 */
export type GuessQuestion = {
  kind: "guess";
  id: string;
  prompt: string;
  unit: string;
  answer: number;
  answerText: string;
  metricKey: string;
};

export type PickQuestion = {
  kind: "pick";
  id: string;
  prompt: string;
  options: { code: string; name: string }[];
  answerCode: string;
  explanation: string;
  metricKey: string;
};

export type QuizQuestion = GuessQuestion | PickQuestion;

const PICK_METRICS: { key: string; prompt: (industry: string) => string }[] = [
  { key: "store_count", prompt: (industry) => `${industry} 점포가 가장 많은 상권은 어디일까요?` },
  { key: "total_population", prompt: () => "추정 유동인구가 가장 많은 상권은 어디일까요?" },
  { key: "weekend_sales_ratio", prompt: () => "매출 중 주말 비중이 가장 높은 상권은 어디일까요?" },
];

function availableValues(metric: ComparisonMetric | undefined, codes: string[]): Map<string, number> | null {
  if (!metric) return null;
  const values = new Map<string, number>();
  for (const code of codes) {
    const item = metric.values.find((value) => value.trade_area_code === code);
    if (!item || item.status !== "available" || item.value === null) return null;
    values.set(code, item.value);
  }
  return values;
}

export function buildQuiz(data: ComparisonResponse): QuizQuestion[] {
  const metrics = new Map(data.metrics.map((metric) => [metric.metric_key, metric]));
  const codes = data.trade_areas.map((area) => area.code);
  const names = new Map(data.trade_areas.map((area) => [area.code, area.name]));
  const questions: QuizQuestion[] = [];

  const stores = metrics.get("store_count");
  const first = data.trade_areas[0];
  const firstStore = stores?.values.find((value) => value.trade_area_code === first.code);
  if (stores && firstStore?.status === "available" && firstStore.value !== null) {
    questions.push({
      kind: "guess",
      id: `guess-store-${first.code}`,
      prompt: `${first.name}에 ${data.industry_name} 점포는 몇 개일까요?`,
      unit: stores.unit,
      answer: firstStore.value,
      answerText: formatMetricValue(firstStore.value, stores.unit),
      metricKey: "store_count",
    });
  }

  for (const { key, prompt } of PICK_METRICS) {
    const metric = metrics.get(key);
    const values = availableValues(metric, codes);
    if (!metric || !values) continue;
    const max = Math.max(...values.values());
    const winners = codes.filter((code) => values.get(code) === max);
    if (winners.length !== 1) continue;
    questions.push({
      kind: "pick",
      id: `pick-${key}`,
      prompt: prompt(data.industry_name),
      options: codes.map((code) => ({ code, name: names.get(code) || code })),
      answerCode: winners[0],
      explanation: codes.map((code) => `${names.get(code)} ${formatMetricValue(values.get(code) ?? null, metric.unit)}`).join(" · "),
      metricKey: key,
    });
  }
  return questions;
}

export function guessFeedback(question: GuessQuestion, guess: number): string {
  const difference = Math.abs(guess - question.answer);
  if (difference === 0) return `정확해요! 공식 값은 ${question.answerText}입니다.`;
  return `공식 값은 ${question.answerText}로, 입력한 값과 ${difference.toLocaleString("ko-KR")}${question.unit} 차이가 나요.`;
}
