import { formatMetricValue, METRIC_GROUPS } from "./comparison";
import type { ComparisonExportResponse, EvidenceResponse } from "./types";

/** 인쇄(PDF 저장) 전용 비교 리포트. 값은 백엔드 응답을 그대로 쓰고 다시 계산하지 않습니다. */
export function ComparisonReportPrint({ report }: { report: ComparisonExportResponse }) {
  const { comparison } = report;
  const metrics = new Map(comparison.metrics.map((metric) => [metric.metric_key, metric]));
  const evidence = new Map(report.evidence.map((item) => [item.metric_key, item]));
  const ordered = METRIC_GROUPS.flatMap((group) => group.keys.map((key) => ({ group: group.title, key }))).filter(({ key }) => metrics.has(key));
  const generated = new Date(report.generated_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return <article className="print-report" aria-label="비교 리포트 인쇄본">
    <header className="print-report__header">
      <p>골목 레이더 · 서울 공식 상권 비교 리포트</p>
      <h1>{comparison.trade_areas.map((area) => area.name).join(" · ")}</h1>
      <dl>
        <div><dt>업종</dt><dd>{comparison.industry_name} ({comparison.industry_code})</dd></div>
        <div><dt>기준분기</dt><dd>{comparison.quarter_label} ({comparison.quarter_code})</dd></div>
        <div><dt>생성 일시</dt><dd>{generated} (한국시간)</dd></div>
        <div><dt>비교 ID</dt><dd>{comparison.comparison_id}</dd></div>
      </dl>
      <ol className="print-report__areas">
        {comparison.trade_areas.map((area, index) => <li key={area.code}><strong>{String(index + 1).padStart(2, "0")} {area.name}</strong> {area.district_name} · {area.area_type_name} · 상권 코드 {area.code}</li>)}
      </ol>
    </header>

    <section>
      <h2>지표 비교</h2>
      <table className="print-report__table">
        <thead><tr><th scope="col">지표</th>{comparison.trade_areas.map((area) => <th scope="col" key={area.code}>{area.name}</th>)}</tr></thead>
        <tbody>
          {METRIC_GROUPS.map((group) => {
            const rows = group.keys.map((key) => metrics.get(key)).filter((metric) => metric !== undefined);
            return [<tr key={group.title} className="print-report__group"><th colSpan={comparison.trade_areas.length + 1}>{group.title}</th></tr>,
              ...rows.map((metric) => <tr key={metric.metric_key}>
                <th scope="row">{metric.label} <small>({metric.unit})</small></th>
                {comparison.trade_areas.map((area) => {
                  const item = metric.values.find((value) => value.trade_area_code === area.code);
                  const available = item?.status === "available" && item.value !== null;
                  return <td key={area.code}>{available ? formatMetricValue(item.value, metric.unit) : <>비교 불가<small>{item?.reason || "원천 데이터 없음"}</small></>}</td>;
                })}
              </tr>)];
          })}
        </tbody>
      </table>
    </section>

    <section>
      <h2>지표별 근거</h2>
      {ordered.map(({ key }) => {
        const item = evidence.get(key);
        return item ? <EvidenceBlock key={key} item={item} /> : null;
      })}
    </section>

    <section className="print-report__limits">
      <h2>읽을 때 주의할 점</h2>
      <ul>{report.limitations.map((line) => <li key={line}>{line}</li>)}</ul>
    </section>
  </article>;
}

function EvidenceBlock({ item }: { item: EvidenceResponse }) {
  return <div className="print-report__evidence">
    <h3>{item.label} <small>({item.unit})</small></h3>
    <p>출처: {item.dataset_name} · {item.provider} · 원천 파일 {item.source_file}{item.fetched_at ? ` · 수집 ${item.fetched_at.slice(0, 10)}` : ""}</p>
    <p>계산식: {item.formula || "원천값 그대로 사용"}{item.rounding ? ` · 반올림: ${item.rounding}` : ""}</p>
    <table>
      <thead><tr><th scope="col">상권</th><th scope="col">값</th><th scope="col">분자</th><th scope="col">분모</th><th scope="col">필터</th></tr></thead>
      <tbody>{item.areas.map((area) => <tr key={area.trade_area_code}>
        <th scope="row">{area.trade_area_name} ({area.trade_area_code})</th>
        <td>{area.status === "available" && area.value !== null ? formatMetricValue(area.value, item.unit) : `비교 불가 — ${area.reason || "원천 데이터 없음"}`}</td>
        <td>{area.numerator === null ? "—" : area.numerator.toLocaleString("ko-KR")}</td>
        <td>{area.denominator === null ? "—" : area.denominator.toLocaleString("ko-KR")}</td>
        <td className="print-report__filter">{Object.entries(area.filter).map(([name, value]) => <span key={name}>{name}={value}</span>)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
