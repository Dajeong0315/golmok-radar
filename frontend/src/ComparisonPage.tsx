import { useEffect, useMemo, useState } from "react";

import { fetchComparison } from "./api";
import { formatMetricValue, METRIC_GROUPS } from "./comparison";
import type { ComparisonResponse } from "./types";

type Props = { codes: string[] };

export function ComparisonPage({ codes }: Props) {
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (codes.length < 2) return;
    const controller = new AbortController();
    fetchComparison(codes, controller.signal).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [codes.join(",")]);

  const metrics = useMemo(() => new Map(data?.metrics.map((metric) => [metric.metric_key, metric]) || []), [data]);

  if (codes.length < 2) return <CompareState title="비교할 상권이 부족합니다" copy="관심 목록에서 두 곳 이상을 선택해 주세요." />;
  if (error) return <CompareState title="비교 정보를 불러오지 못했습니다" copy={error} />;
  if (!data) return <CompareState title="비교표를 만드는 중입니다" copy="같은 기준분기의 데이터를 정렬하고 있습니다." loading />;

  return (
    <div className="compare-page">
      <header className="site-header compare-header">
        <a className="brand" href="#top" aria-label="상권 탐색으로 돌아가기"><span className="brand-mark">G</span><span>골목 레이더</span></a>
        <a className="back-link" href="#top">← 관심 목록으로</a>
      </header>
      <main>
        <section className="compare-hero">
          <p className="eyebrow">상권 비교 · {data.quarter_label}</p>
          <h1>나란히 놓고 보면,<br /><em>차이가 선명해집니다.</em></h1>
          <p>값의 크기는 성공 가능성이나 추천 점수가 아닙니다. 같은 출처와 기준으로 후보지의 특성을 확인하세요.</p>
        </section>

        <section className="comparison-section" aria-labelledby="comparison-title">
          <div className="comparison-title-row">
            <div><p className="eyebrow">2–4 AREAS</p><h2 id="comparison-title">{data.trade_areas.length}개 상권 비교</h2></div>
            <span className="quarter-badge">기준 {data.quarter_label}</span>
          </div>
          <div className="comparison-scroll" tabIndex={0} aria-label="상권 지표 비교표">
            <table className="comparison-table">
              <thead><tr><th scope="col">지표</th>{data.trade_areas.map((area, index) => (
                <th scope="col" key={area.code}><span className="column-number">0{index + 1}</span><small>{area.district_name} · {area.area_type_name}</small><strong>{area.name}</strong></th>
              ))}</tr></thead>
              <tbody>
                {METRIC_GROUPS.flatMap((group) => {
                  const rows = group.keys.map((key) => metrics.get(key)).filter(Boolean);
                  return [
                    <tr className="metric-group" key={`${group.title}-heading`}><th colSpan={data.trade_areas.length + 1}>{group.title}</th></tr>,
                    ...rows.map((metric) => metric && (
                      <tr key={metric.metric_key}>
                        <th scope="row"><strong>{metric.label}</strong><small>{metric.unit}</small></th>
                        {data.trade_areas.map((area) => {
                          const item = metric.values.find((value) => value.trade_area_code === area.code);
                          const unavailable = !item || item.status !== "available" || item.value === null;
                          return <td className={unavailable ? "unavailable" : ""} key={area.code}>
                            <strong>{formatMetricValue(item?.value ?? null, metric.unit)}</strong>
                            {unavailable ? <small>{item?.reason || "원천 데이터 없음"}</small> : null}
                          </td>;
                        })}
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          </div>
          <p className="scroll-hint">화면이 좁으면 표를 좌우로 움직여 모든 상권을 확인할 수 있습니다.</p>
        </section>
      </main>
    </div>
  );
}

function CompareState({ title, copy, loading = false }: { title: string; copy: string; loading?: boolean }) {
  return <main className="compare-state">
    <span className={loading ? "state-pulse" : "state-mark"}>{loading ? "" : "!"}</span>
    <p className="eyebrow">골목 레이더</p><h1>{title}</h1><p>{copy}</p>
    {!loading ? <a href="#top">상권 탐색으로 돌아가기</a> : null}
  </main>;
}
