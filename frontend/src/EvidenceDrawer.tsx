import { useEffect, useState } from "react";

import { fetchEvidence } from "./api";
import { formatMetricValue } from "./comparison";
import type { EvidenceResponse } from "./types";

type Props = { comparisonId: string; metricKey: string; onClose: () => void };

export function EvidenceDrawer({ comparisonId, metricKey, onClose }: Props) {
  const [evidence, setEvidence] = useState<EvidenceResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchEvidence(comparisonId, metricKey, controller.signal).then(setEvidence).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { controller.abort(); window.removeEventListener("keydown", closeOnEscape); };
  }, [comparisonId, metricKey, onClose]);

  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="evidence-title">
      <button className="drawer-close" onClick={onClose} aria-label="근거 보기 닫기">×</button>
      {!evidence && !error ? <p className="drawer-loading">근거 데이터를 불러오는 중입니다.</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}
      {evidence ? <>
        <p className="eyebrow">DATA EVIDENCE</p>
        <h2 id="evidence-title">{evidence.label}</h2>
        <dl className="evidence-meta">
          <div><dt>제공기관</dt><dd>{evidence.provider}</dd></div>
          <div><dt>데이터셋</dt><dd>{evidence.dataset_name}</dd></div>
          <div><dt>기준분기</dt><dd>{evidence.quarter_code}</dd></div>
          <div><dt>수집일</dt><dd>{evidence.fetched_at || "로컬 원천 파일 기준"}</dd></div>
          <div className="wide"><dt>원천 파일</dt><dd>{evidence.source_file}</dd></div>
          {evidence.formula ? <div className="wide"><dt>계산식</dt><dd>{evidence.formula}</dd></div> : null}
          {evidence.rounding ? <div className="wide"><dt>반올림</dt><dd>{evidence.rounding}</dd></div> : null}
        </dl>
        <div className="evidence-areas">
          {evidence.areas.map((area) => <article key={area.trade_area_code}>
            <header><div><small>{area.trade_area_code}</small><h3>{area.trade_area_name}</h3></div><strong>{formatMetricValue(area.value, evidence.unit)}</strong></header>
            {area.reason ? <p className="evidence-reason">{area.reason}</p> : null}
            <dl>
              {area.numerator !== null ? <div><dt>분자</dt><dd>{area.numerator.toLocaleString("ko-KR")}</dd></div> : null}
              {area.denominator !== null ? <div><dt>분모</dt><dd>{area.denominator.toLocaleString("ko-KR")}</dd></div> : null}
              <div><dt>필터</dt><dd>{Object.entries(area.filter).map(([key, value]) => `${key}=${value}`).join(" · ")}</dd></div>
            </dl>
          </article>)}
        </div>
      </> : null}
    </aside>
  </div>;
}
