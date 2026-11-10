import { useEffect, useMemo, useState } from "react";

import { fetchChecklist, fetchComparison, fetchComparisonExport } from "./api";
import { formatMetricValue, METRIC_GROUPS } from "./comparison";
import { buildCardModel, cardFileName, drawCard } from "./comparisonCard";
import { ComparisonQuiz } from "./ComparisonQuiz";
import { ComparisonReportPrint } from "./ComparisonReportPrint";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { loadPrintFonts } from "./printFonts";
import type { ChecklistResponse, ComparisonExportResponse, ComparisonResponse } from "./types";
import { TopNavigation } from "./TopNavigation";

type Props = { codes: string[]; industry: string; quarter?: string };

export function ComparisonPage({ codes, industry, quarter }: Props) {
  const [data, setData] = useState<ComparisonResponse | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [evidenceKey, setEvidenceKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [printReport, setPrintReport] = useState<ComparisonExportResponse | null>(null);
  const [printState, setPrintState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (codes.length < 2) return;
    const controller = new AbortController();
    fetchComparison(codes, industry, controller.signal, quarter).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [codes.join(","), industry, quarter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchChecklist(controller.signal).then(setChecklist).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (printState !== "ready" || !printReport) return;
    // 인쇄본이 화면에 그려지고 그 글자의 한글 글꼴을 받은 다음 인쇄 창을 엽니다. 사용자는 대상에서 'PDF로 저장'을 고릅니다.
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const text = document.querySelector(".print-report")?.textContent || "";
      void loadPrintFonts(text).then(() => { if (!cancelled) window.print(); });
    });
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [printState, printReport]);

  const savePdf = () => {
    if (!data) return;
    setPrintState("loading");
    fetchComparisonExport(data.comparison_id)
      .then((report) => { setPrintReport(report); setPrintState("ready"); })
      .catch(() => setPrintState("error"));
  };

  const [cardState, setCardState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveCard = async () => {
    if (!data) return;
    setCardState("saving");
    try {
      await document.fonts?.ready;
      const canvas = document.createElement("canvas");
      drawCard(canvas, buildCardModel(data));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("이미지를 만들지 못했습니다.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = cardFileName(new Date());
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCardState("saved");
    } catch {
      setCardState("error");
    }
  };

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
            <div className="comparison-actions">
              <span className="quarter-badge">{data.industry_name} · {data.quarter_label}</span>
              <button type="button" className="report-save-button" onClick={savePdf} disabled={printState === "loading"}>{printState === "loading" ? "리포트 준비 중…" : "리포트 저장 (PDF)"}</button>
              <button type="button" className="card-save-button" onClick={() => void saveCard()} disabled={cardState === "saving"}>{cardState === "saving" ? "이미지 만드는 중…" : "비교 카드 이미지 저장"}</button>
            </div>
          </div>
          {printState === "ready" ? <p className="report-save-help" role="status">인쇄 창의 대상에서 ‘PDF로 저장’을 고르세요. 지표마다 출처·기준분기·계산식이 함께 저장됩니다.</p> : null}
          {printState === "error" ? <p className="report-save-help error" role="alert">리포트 내용을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</p> : null}
          {cardState === "saved" ? <p className="report-save-help" role="status">비교 카드 이미지를 이 기기에 저장했습니다. 지표 네 개를 나란히 놓은 그림이며 추천이나 순위가 아닙니다.</p> : null}
          {cardState === "error" ? <p className="report-save-help error" role="alert">이 브라우저에서 이미지를 만들지 못했습니다. 리포트 저장(PDF)을 이용해 주세요.</p> : null}
          <ComparisonQuiz data={data} />
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
      {printReport ? <ComparisonReportPrint report={printReport} /> : null}
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
