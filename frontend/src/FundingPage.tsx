import { FormEvent, useEffect, useMemo, useState } from "react";

import { fetchSupportPrograms, fetchTradeAreas } from "./api";
import { loadProfile } from "./founderProfile";
import { selectAdditionalFundingGuides, selectBankFundingGuides, type FundingStage } from "./fundingGuides";
import type { SupportProgramResponse, TradeArea } from "./types";
import { TopNavigation } from "./TopNavigation";
import { useAuth } from "./auth";

export function FundingPage({ code }: { code: string }) {
  const { user } = useAuth();
  const profile = loadProfile(localStorage, user?.id ?? null);
  const [stage, setStage] = useState<FundingStage>("pre_startup");
  const [age, setAge] = useState(30);
  const [years, setYears] = useState(1);
  const [area, setArea] = useState<TradeArea | null>(null);
  const [result, setResult] = useState<SupportProgramResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const bankGuides = useMemo(() => selectBankFundingGuides(profile?.answers || null, stage), [profile, stage]);
  const additionalGuides = useMemo(() => selectAdditionalFundingGuides(stage, years), [stage, years]);

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    fetchTradeAreas(undefined, controller.signal)
      .then((areas) => setArea(areas.find((item) => item.code === code) || null))
      .catch(() => setArea(null));
    return () => controller.abort();
  }, [code]);

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
        <a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a>
        <TopNavigation active="funding" />
        <div className="header-context"><strong>공식 출처만</strong></div>
      </header>
      <main>
        <section className="funding-hero">
          <p className="eyebrow">공식 지원 정보</p>
          <h1>지원사업과 자금 후보를<br />공식 조건부터 확인하세요.</h1>
          <p>{area ? `${area.district_name} ${area.name}에서 준비하는 조건을 서울 지역 기준으로 살펴봅니다. ` : "서울에서 준비하는 조건을 기준으로 살펴봅니다. "}민감한 신용·부채 정보는 받지 않고 승인 가능성도 예측하지 않습니다.</p>
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
        <section className="bank-funding" aria-labelledby="bank-funding-title">
          <div className="result-section-heading"><div><p className="eyebrow">IBK · KDB 공식 확인 후보</p><h2 id="bank-funding-title">성향과 사업 단계에 맞춰<br />먼저 볼 두 가지</h2></div><p>성향은 자금의 쓰임을 설명하는 데만 사용해요. 실제 대상 여부·금리·한도는 공식 페이지와 은행 심사에서 결정됩니다.</p></div>
          {area ? <div className="funding-area-context"><span>선택 상권</span><strong>{area.district_name} · {area.name}</strong><p>상권의 임대비와 예상 운영비는 상담용 사업계획을 정리하는 데 활용하세요. 상권 점수로 대출 승인 가능성을 계산하지 않습니다.</p></div> : null}
          <div className="bank-guide-grid">
            {bankGuides.map((guide) => <article className="bank-guide-card" key={guide.id}>
              <div className="bank-guide-card__meta"><span>{guide.institution}</span><small>{guide.category}</small></div>
              <h3>{guide.title}</h3>
              <p className="bank-guide-reason"><strong>이 조건에서 보는 이유</strong>{guide.reason}</p>
              <dl><div><dt>공식 대상</dt><dd>{guide.eligibility}</dd></div><div><dt>직접 확인</dt><dd>{guide.confirmation}</dd></div></dl>
              <footer><span>{guide.checkedAt} 확인</span><a href={guide.sourceUrl} target="_blank" rel="noreferrer">공식 안내 보기 ↗</a></footer>
            </article>)}
          </div>
          <div className="additional-funding-heading"><div><p className="eyebrow">추가 확인 경로</p><h3>정부·서울시 지원과<br />다른 은행 상품</h3></div><p>{stage === "existing" && years >= 1 ? "사업 1년 이상 조건을 반영해 일반 개인사업자 상품까지 보여드려요." : "현재 단계에서 바로 확인하거나 사업자등록 후 살펴볼 공식 경로예요."}</p></div>
          <div className="additional-funding-grid">
            {additionalGuides.map((guide) => <article key={guide.id}>
              <div><span>{guide.category}</span><small>{guide.institution}</small></div>
              <h4>{guide.title}</h4><p>{guide.summary}</p>
              <details><summary>대상 조건 확인</summary><p>{guide.confirmation}</p></details>
              <footer><span>{guide.checkedAt} 확인</span><a href={guide.sourceUrl} target="_blank" rel="noreferrer">공식 안내 ↗</a></footer>
            </article>)}
          </div>
          <div className="funding-safety-note"><strong>지역 필터를 이렇게 적용했어요</strong><p>현재 후보가 서울이므로 KDB의 지방소재 지역경제활성화 자금은 제외했습니다. 은행 상품을 서로 금리순으로 비교하거나 신청을 대신하지 않으며, 대출 전에는 상환 계획과 상품설명서를 반드시 확인해야 합니다.</p></div>
        </section>
        <section className="official-links">
          <div><p className="eyebrow">창업진흥원</p><h2>K-Startup</h2><p>창업지원포털에서 모집 중인 지원사업 공고를 직접 검색합니다.</p><a href="https://www.k-startup.go.kr/" target="_blank" rel="noreferrer">공식 포털 열기 →</a></div>
          <div><p className="eyebrow">소상공인시장진흥공단</p><h2>소상공인 정책자금</h2><p>대출상품 추천이 아니라 소상공인시장진흥공단의 공식 신청·안내 경로입니다.</p><a href="https://ols.semas.or.kr/" target="_blank" rel="noreferrer">공식 사이트 열기 →</a></div>
        </section>
        <section className="funding-next"><div><p className="eyebrow">다음 단계</p><h2>개업 전 흐름은 여기까지입니다.</h2><p>계약 여부는 직접 결정하고, 개업 후 리뷰 기능은 별도의 운영 개선 단계에서만 이용합니다.</p></div><a href="#reviews">운영 개선 단계 보기 →</a></section>
      </main>
    </div>
  );
}
