import { useEffect, useMemo, useState } from "react";

import { fetchChecklist, fetchComparison } from "./api";
import { formatMetricValue, METRIC_GROUPS } from "./comparison";
import { EvidenceDrawer } from "./EvidenceDrawer";
import type { ChecklistResponse, ComparisonResponse } from "./types";
import { TopNavigation } from "./TopNavigation";

type Props = { codes: string[]; industry: string };

export function ComparisonPage({ codes, industry }: Props) {
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [evidenceKey, setEvidenceKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (codes.length < 2) return;
    const controller = new AbortController();
    fetchComparison(codes, industry, controller.signal).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [codes.join(","), industry]);

  useEffect(() => {
    const controller = new AbortController();
    fetchChecklist(controller.signal).then(setChecklist).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const metrics = useMemo(() => new Map(data?.metrics.map((metric) => [metric.metric_key, metric]) || []), [data]);

  if (codes.length < 2) return <CompareState title="비교할 상권이 부족합니다" copy="관심 목록에서 두 곳 이상을 선택해 주세요." />;
  if (error) return <CompareState title="비교 정보를 불러오지 못했습니다" copy={error} />;
  if (!data) return <CompareState title="비교표를 만드는 중입니다" copy="같은 기준분기의 데이터를 정렬하고 있습니다." loading />;

  return (
    <div className="compare-page">
      <header className="site-header compare-header">
        <a className="brand" href="#home" aria-label="골목 레이더 홈"><span className="brand-mark">G</span><span>골목 레이더</span></a>
        <TopNavigation active="explore" />
        <a className="back-link" href="#favorites-title">관심 목록</a>
      </header>
      <main>
        <section className="compare-hero">
          <p className="eyebrow">{data.industry_name} 상권 비교 · {data.quarter_label}</p>
          <h1>나란히 놓고 보면<br />상권의 차이를 쉽게 찾을 수 있어요.</h1>
          <p>값의 크기는 성공 가능성이나 추천 점수가 아닙니다. 같은 출처와 기준으로 후보지의 특성을 확인하세요.</p>
        </section>

        <section className="comparison-section" aria-labelledby="comparison-title">
          <div className="comparison-title-row">
            <div><p className="eyebrow">같은 분기 비교</p><h2 id="comparison-title">{data.trade_areas.length}개 상권 비교</h2></div>
            <span className="quarter-badge">{data.industry_name} · {data.quarter_label}</span>
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
                        <th scope="row"><strong>{metric.label}</strong><small>{metric.unit}</small><button className="evidence-button" onClick={() => setEvidenceKey(metric.metric_key)}>근거 보기</button></th>
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
          <div className="comparison-next"><div><p className="eyebrow">다음: 검증</p><h2>수치 비교 뒤에는<br />직접 본 매물을 기록하세요.</h2><p>공식 통계는 후보 상권의 특성을 확인하는 근거입니다. 실제 보증금·월세·시설·계약 전 확인 상태는 매물 워크시트에 직접 남깁니다.</p></div><div><a className="primary-action" href="#worksheet">매물 검증 워크시트 열기 <span>→</span></a><a href={`#rent?code=${data.trade_areas[0].code}`}>선택 상권의 R-ONE 임대 벤치마크 보기</a></div></div>
        </section>

        {checklist ? <section className="checklist-section" aria-labelledby="checklist-title">
          <div className="checklist-intro"><p className="eyebrow">직접 방문할 때</p><h2 id="checklist-title">숫자로 알 수 없는 것은<br />현장에서 확인하세요.</h2><p>{checklist.notice}</p></div>
          <ol className="checklist-grid">
            {checklist.items.map((item, index) => <li key={item.question}><span>0{index + 1}</span><small>{item.category}</small><strong>{item.question}</strong></li>)}
          </ol>
        </section> : null}
      </main>
      {evidenceKey ? <EvidenceDrawer comparisonId={data.comparison_id} metricKey={evidenceKey} onClose={() => setEvidenceKey(null)} /> : null}
    </div>
  );
}

function CompareState({ title, copy, loading = false }: { title: string; copy: string; loading?: boolean }) {
  return <main className="compare-state">
    <span className={loading ? "state-pulse" : "state-mark"}>{loading ? "" : "!"}</span>
    <p className="eyebrow">골목 레이더</p><h1>{title}</h1><p>{copy}</p>
    {!loading ? <a href="#explore">상권 탐색으로 돌아가기</a> : null}
  </main>;
}
