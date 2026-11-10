import { formatMetricValue } from "./comparison";
import type { ComparisonResponse } from "./types";

/**
 * 나란히 보기 카드 (Phase 44). 비교 중인 상권의 지표 네 개를 같은 순서로 나란히 놓은 이미지입니다.
 * 승패·점수·등급·강조 표시를 하지 않고, 값은 비교 API의 원천값을 표시 형식만 바꿔 씁니다.
 */
export const CARD_METRICS = ["store_count", "sales_amount", "total_population", "weekend_sales_ratio"] as const;
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

export type CardModel = {
  title: string;
  subtitle: string;
  areas: { code: string; name: string; meta: string; district: string }[];
  rows: { label: string; values: string[] }[];
  footer: string[];
};

/** 카드 칸이 좁아 1억 원 이상 금액만 억 원 단위(소수 첫째 자리)로 표시합니다. 정확한 값은 비교표·리포트에 있습니다. */
export function formatCardValue(value: number, unit: string): string {
  if (unit === "원" && Math.abs(value) >= 100_000_000) {
    return `${(value / 100_000_000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}억 원`;
  }
  return formatMetricValue(value, unit);
}

export function buildCardModel(data: ComparisonResponse): CardModel {
  const metrics = new Map(data.metrics.map((metric) => [metric.metric_key, metric]));
  let compacted = false;
  const rows = CARD_METRICS.flatMap((key) => {
    const metric = metrics.get(key);
    if (!metric) return [];
    return [{
      label: metric.label,
      values: data.trade_areas.map((area) => {
        const item = metric.values.find((value) => value.trade_area_code === area.code);
        if (item?.status !== "available" || item.value === null) return "비교 불가";
        const text = formatCardValue(item.value, metric.unit);
        if (text !== formatMetricValue(item.value, metric.unit)) compacted = true;
        return text;
      }),
    }];
  });
  return {
    title: "상권 나란히 보기",
    subtitle: `${data.industry_name} · ${data.quarter_label}`,
    areas: data.trade_areas.map((area) => ({ code: area.code, name: area.name, meta: `${area.district_name} · ${area.area_type_name}`, district: area.district_name })),
    rows,
    footer: [
      `출처: 서울시 상권분석서비스(서울신용보증재단) · 기준분기 ${data.quarter_label} (${data.quarter_code})`,
      ...(compacted ? ["억 원 값은 소수 첫째 자리로 반올림했습니다. 정확한 값은 비교표·리포트에서 확인하세요."] : []),
      "추천이 아닙니다. 값의 크기는 창업 성공 가능성을 뜻하지 않습니다.",
      "골목 레이더",
    ],
  };
}

export function cardFileName(date: Date): string {
  const local = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
  return `golmok-radar-card-${local}.png`;
}

const INK = "#1E2622";
const SOFT = "#56615B";
const LINE = "#D3D9D0";
const PAPER = "#F1F3EE";
const LANE = "#F2C12E";

/** 글자 크기를 줄여 한 줄에 맞춥니다. 최소 크기에서도 넘치면 그때만 말줄임표를 씁니다. */
function fitFont(context: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, size: number, minSize: number): string {
  for (let current = size; current >= minSize; current -= 2) {
    context.font = font(current);
    if (context.measureText(text).width <= maxWidth) return text;
  }
  return fitText(context, text, maxWidth);
}

/** 상권 이름을 두 줄까지 나눕니다. */
function wrapTwoLines(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (context.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/(?<=[\s(·])/);
  let first = "";
  let index = 0;
  while (index < words.length && context.measureText(first + words[index]).width <= maxWidth) first += words[index++];
  if (!first) {
    let cut = 0;
    while (cut < text.length && context.measureText(text.slice(0, cut + 1)).width <= maxWidth) cut += 1;
    first = text.slice(0, cut);
    return [first, fitText(context, text.slice(cut), maxWidth)];
  }
  return [first.trimEnd(), fitText(context, words.slice(index).join(""), maxWidth)];
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** 모델을 1080×1350 캔버스에 그립니다. 브라우저에서만 호출합니다. */
export function drawCard(canvas: HTMLCanvasElement, model: CardModel): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 그릴 수 없는 브라우저입니다.");
  const display = '"Black Han Sans", "IBM Plex Sans KR", sans-serif';
  const body = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const margin = 72;
  const labelWidth = 250;
  const columnWidth = (CARD_WIDTH - margin * 2 - labelWidth) / model.areas.length;

  context.fillStyle = PAPER;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = LANE;
  for (let x = 0; x < CARD_WIDTH; x += 56) context.fillRect(x, 230, 36, 6);

  context.fillStyle = "#1F6B57";
  context.font = `600 30px ${body}`;
  context.fillText(model.subtitle, margin, 110);
  context.fillStyle = INK;
  context.font = `76px ${display}`;
  context.fillText(model.title, margin, 196);

  const headerTop = 300;
  model.areas.forEach((area, index) => {
    const x = margin + labelWidth + columnWidth * index + 16;
    context.fillStyle = SOFT;
    const meta = fitFont(context, area.meta, columnWidth - 28, (size) => `500 ${size}px ${body}`, 24, 20);
    context.fillText(meta === area.meta ? meta : fitText(context, area.district, columnWidth - 28), x, headerTop);
    context.fillStyle = INK;
    context.font = `700 34px ${body}`;
    wrapTwoLines(context, area.name, columnWidth - 28).forEach((line, lineIndex) => context.fillText(line, x, headerTop + 48 + lineIndex * 40));
  });

  const rowTop = 450;
  const rowHeight = (CARD_HEIGHT - rowTop - 250) / Math.max(model.rows.length, 1);
  model.rows.forEach((row, rowIndex) => {
    const y = rowTop + rowHeight * rowIndex;
    context.fillStyle = LINE;
    context.fillRect(margin, y, CARD_WIDTH - margin * 2, 2);
    context.fillStyle = SOFT;
    context.font = `600 28px ${body}`;
    context.fillText(fitText(context, row.label, labelWidth - 20), margin, y + rowHeight / 2 + 10);
    row.values.forEach((value, index) => {
      const x = margin + labelWidth + columnWidth * index + 16;
      const unavailable = value === "비교 불가";
      context.fillStyle = unavailable ? "#8A4B12" : INK;
      const weight = unavailable ? 600 : 700;
      const text = fitFont(context, value, columnWidth - 28, (size) => `${weight} ${size}px ${body}`, unavailable ? 30 : 38, 24);
      context.fillText(text, x, y + rowHeight / 2 + 14);
    });
  });
  context.fillStyle = LINE;
  context.fillRect(margin, rowTop + rowHeight * model.rows.length, CARD_WIDTH - margin * 2, 2);

  context.fillStyle = SOFT;
  context.font = `500 22px ${body}`;
  const notes = model.footer.slice(0, -1);
  notes.forEach((line, index) => context.fillText(fitText(context, line, CARD_WIDTH - margin * 2), margin, CARD_HEIGHT - 110 - (notes.length - 1 - index) * 34));
  context.fillStyle = INK;
  context.font = `34px ${display}`;
  context.fillText(model.footer[model.footer.length - 1], margin, CARD_HEIGHT - 48);
}
