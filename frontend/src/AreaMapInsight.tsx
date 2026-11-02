import type { AreaInsightMetric, AreaMapInsightResponse } from "./types";

function formatMetric(metric: AreaInsightMetric) {
  if (metric.status !== "available" || metric.value === null) return metric.reason || "비교 불가";
  if (metric.unit === "%") return `${metric.value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
  return `${metric.value.toLocaleString("ko-KR")} ${metric.unit}`;
}

function relativePosition(metric: AreaInsightMetric) {
  if (metric.status !== "available" || metric.percentile === null) return "상대 위치 비교 불가";
  return `비교군 상위 ${Math.max(0, 100 - metric.percentile + 1).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}%`;
}

export function AreaMapInsight({ data, loading, error }: {
  data: AreaMapInsightResponse | null;
  loading: boolean;
  error: string;
}) {
  if (!data && !loading && !error) return null;
  if (loading) return <section className="map-insight map-insight--state" aria-live="polite">선택한 상권의 공식 통계 근거를 불러오는 중입니다.</section>;
  if (error) return <section className="map-insight map-insight--state">{error}</section>;
  if (!data) return null;

  return <section className="map-insight" aria-labelledby="map-insight-title">
    <header>
      <div><p className="eyebrow">선택 상권의 공식 통계 근거</p><h3 id="map-insight-title">{data.trade_area.name}</h3></div>
      <span>{data.quarter_label} · 상권 단위 공식 통계</span>
    </header>
    <div className="map-insight__metrics">
      <article><span>총 유동인구</span><strong>{formatMetric(data.total_population)}</strong><small>{data.population_source}<br />{relativePosition(data.total_population)}</small></article>
      <article><span>업종 추정매출</span><strong>{formatMetric(data.sales_amount)}</strong><small>{data.sales_source}<br />{relativePosition(data.sales_amount)}</small></article>
      <article><span>주중 매출 비중</span><strong>{formatMetric(data.weekday_sales_ratio)}</strong><small>선택 업종 주중 매출 금액 ÷ 전체 매출 금액</small></article>
      <article><span>주말 매출 비중</span><strong>{formatMetric(data.weekend_sales_ratio)}</strong><small>선택 업종 주말 매출 금액 ÷ 전체 매출 금액</small></article>
    </div>
    <p className="map-insight__comparison">상대 위치 기준: {data.comparison_group_label} {data.comparison_group_count}곳. 수치의 높고 낮음은 상권의 좋고 나쁨이나 성공을 뜻하지 않습니다.</p>
    <div className="map-insight__distribution">
      <div><h4>시간대별 유동인구 분포</h4><p>막대 길이는 이 상권의 총 유동인구 대비 시간대 비중입니다.</p></div>
      <div className="time-slot-chart">
        {data.time_slots.map((slot) => <div className="time-slot" key={slot.metric_key}>
          <span>{slot.label}</span><div className="time-slot__track" aria-label={`${slot.label} 유동인구 비중`}><i style={{ width: `${slot.ratio ?? 0}%` }} /></div><strong>{slot.status === "available" && slot.ratio !== null ? `${slot.ratio.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%` : "비교 불가"}</strong>
        </div>)}
      </div>
    </div>
    <p className="map-insight__notice">{data.notice}</p>
  </section>;
}
