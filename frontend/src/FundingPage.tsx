import { FormEvent, useState } from "react";

import { fetchSupportPrograms } from "./api";
import type { SupportProgramResponse } from "./types";

export function FundingPage() {
  const [stage, setStage] = useState<"pre_startup" | "existing">("pre_startup");
  const [age, setAge] = useState(30);
  const [years, setYears] = useState(1);
  const [result, setResult] = useState<SupportProgramResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setResult(await fetchSupportPrograms({ stage, region: "서울", age, ...(stage === "existing" ? { years_in_business: years } : {}) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "연동 상태를 확인하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="funding-page">
      <header className="site-header site-header--dark">
        <a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a>
        <div className="header-context"><a href="#top">상권으로 돌아가기</a><strong>공식 출처만</strong></div>
      </header>
      <main>
        <section className="funding-hero">
          <p className="eyebrow">STEP 5 · SUPPORT</p>
          <h1>대출을 권하기 전에,<br /><em>공식 지원 조건</em>부터 봅니다.</h1>
          <p>민감한 신용·부채 정보는 받지 않습니다. 현재 모집 중인 공식 공고만 확인하고, 조건 일치 여부와 사용자가 직접 확인할 항목을 분리합니다.</p>
        </section>
        <section className="funding-layout">
          <form className="funding-form" onSubmit={submit}>
            <p className="eyebrow">최소 조건 입력</p><h2>현재 상황을 알려주세요</h2>
            <fieldset><legend>창업 단계</legend>
              <label><input type="radio" checked={stage === "pre_startup"} onChange={() => setStage("pre_startup")} /> 아직 사업자 등록 전</label>
              <label><input type="radio" checked={stage === "existing"} onChange={() => setStage("existing")} /> 이미 사업자 등록 완료</label>
            </fieldset>
            <label className="funding-number"><span>만 나이</span><input type="number" min="18" max="100" value={age} onChange={(event) => setAge(Number(event.target.value))} /></label>
            {stage === "existing" ? <label className="funding-number"><span>업력(년)</span><input type="number" min="0" max="80" value={years} onChange={(event) => setYears(Number(event.target.value))} /></label> : null}
            <button type="submit" disabled={loading}>{loading ? "공식 연동 확인 중" : "공식 공고 후보 확인"}</button>
            <small>지역은 현재 서비스 범위인 서울로 적용합니다. 선정 가능성이나 대출 승인 여부는 예측하지 않습니다.</small>
          </form>
          <div className="funding-result" aria-live="polite">
            <p className="eyebrow">연동 상태</p>
            {!result && !error ? <><h2>조건을 입력해 확인하세요</h2><p>공식 K-Startup 공고 연동 상태를 먼저 검사합니다.</p></> : null}
            {error ? <div className="error-banner">{error}</div> : null}
            {result ? <>
              <span className={`source-status ${result.status === "available" ? "" : "source-status--muted"}`}>{result.status === "available" ? "공식 공고 확인 완료" : result.status === "no_candidates" ? "현재 조건의 후보 없음" : "공식 API 설정 필요"}</span>
              <h2>{result.candidates.length ? `${result.candidates.length}건을 찾았습니다` : "가짜 후보를 보여주지 않습니다"}</h2>
              <p>{result.message}</p>{result.required_setting ? <code>{result.required_setting}</code> : null}
              {result.candidates.map((candidate) => <article key={candidate.program_id}>
                <p className="eyebrow">{candidate.support_type || "지원 유형 원문 확인"}</p>
                <h3>{candidate.title}</h3>
                <p>접수 {candidate.application_start} ~ {candidate.application_end} · 지역 {candidate.regions.join(", ") || "원문 확인"}</p>
                <p><strong>노출 이유</strong> {candidate.reasons.join(" · ")}</p>
                <p><strong>직접 확인</strong> {candidate.needs_confirmation.join(" · ") || "추가 확인 항목 없음"}</p>
                <details><summary>공고의 신청 대상 보기</summary><p>{candidate.target}</p></details>
                <a href={candidate.source_url} target="_blank" rel="noreferrer">공고 원문 확인 →</a>
              </article>)}
              <small>{result.disclaimer}</small>
            </> : null}
          </div>
        </section>
        <section className="official-links">
          <div><p className="eyebrow">OFFICIAL 01</p><h2>K-Startup</h2><p>창업지원포털에서 모집 중인 지원사업 공고를 직접 검색합니다.</p><a href="https://www.k-startup.go.kr/" target="_blank" rel="noreferrer">공식 포털 열기 →</a></div>
          <div><p className="eyebrow">OFFICIAL 02</p><h2>소상공인 정책자금</h2><p>대출상품 추천이 아니라 소상공인시장진흥공단의 공식 신청·안내 경로입니다.</p><a href="https://ols.semas.or.kr/" target="_blank" rel="noreferrer">공식 사이트 열기 →</a></div>
        </section>
      </main>
    </div>
  );
}
