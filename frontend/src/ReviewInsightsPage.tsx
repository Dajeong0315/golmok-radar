import { ChangeEvent, FormEvent, useState } from "react";

import { analyzeReviewText } from "./api";
import { parseReviewCsv } from "./reviewCsv";
import type { ReviewAnalysisResponse } from "./types";

const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const sentimentLabel = { positive: "긍정", negative: "부정", neutral: "중립" } as const;

export function ReviewInsightsPage() {
  const [shopName, setShopName] = useState("내 가게");
  const [industry, setIndustry] = useState("카페");
  const [radius, setRadius] = useState(500);
  const [shopCount, setShopCount] = useState(3);
  const [period, setPeriod] = useState("최근 3개월");
  const [ownText, setOwnText] = useState("");
  const [nearbyText, setNearbyText] = useState("");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsed = parseReviewCsv(await file.text());
      setOwnText(parsed.own.join("\n"));
      setNearbyText(parsed.nearby.join("\n"));
      setImportNotice(`CSV에서 내 가게 ${parsed.own.length}건, 주변 ${parsed.nearby.length}건을 불러왔습니다.`);
    } catch (reason) {
      setImportNotice("");
      setError(reason instanceof Error ? reason.message : "CSV를 읽지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!ownershipConfirmed || !rightsConfirmed) {
      setError("가게 관리 권한과 리뷰 데이터 사용 권한을 모두 확인해 주세요.");
      return;
    }
    if (!lines(ownText).length || !lines(nearbyText).length) {
      setError("내 가게와 주변 비교군 리뷰를 각각 한 건 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      setResult(await analyzeReviewText({
        own_shop_name: shopName,
        comparison_scope: `반경 ${radius}m · ${industry} · 사용자가 선택한 ${shopCount}곳`,
        period_label: period,
        ownership_confirmed: ownershipConfirmed,
        data_rights_confirmed: rightsConfirmed,
        own_reviews: lines(ownText),
        nearby_reviews: lines(nearbyText),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "리뷰 분석을 완료하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="reviews-page">
    <header className="site-header"><a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a><div className="header-context"><a href="#top">상권 탐색</a><strong>개업 후 운영</strong></div></header>
    <main>
      <section className="reviews-hero"><p className="eyebrow">POST-LAUNCH · REVIEWS</p><h1>리뷰를 세지 말고,<br /><em>운영 질문</em>으로 바꿉니다.</h1><p>내 가게와 내가 정한 주변 동종 가게의 리뷰를 같은 기준으로 비교합니다. 리뷰 작성자 정보는 받지 않고 입력 내용은 저장하지 않습니다.</p></section>
      <form className="reviews-form" onSubmit={submit}>
        <div className="review-context">
          <label><span>내 가게 표시명</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} /></label>
          <label><span>비교 업종</span><input value={industry} onChange={(event) => setIndustry(event.target.value)} /></label>
          <label><span>리뷰 기간</span><input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          <label><span>비교 반경(m)</span><input type="number" min="100" max="5000" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
          <label><span>주변 비교 가게 수</span><input type="number" min="1" max="20" value={shopCount} onChange={(event) => setShopCount(Number(event.target.value))} /></label>
        </div>
        <div className="review-import">
          <div><p className="eyebrow">CSV 가져오기</p><p><code>group,review</code> 두 열을 사용하고 group은 <code>own</code> 또는 <code>nearby</code>로 작성합니다.</p></div>
          <label className="file-button">CSV 선택<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label>
          <a href="/review-import-template.csv" download>예시 CSV 받기</a>
        </div>
        {importNotice ? <p className="import-notice">{importNotice}</p> : null}
        <div className="review-inputs">
          <label><span>내 가게 리뷰 · 한 줄에 하나</span><textarea rows={12} value={ownText} onChange={(event) => setOwnText(event.target.value)} placeholder={'커피가 맛있고 직원이 친절해요\n가격이 조금 비싸요'} /></label>
          <label><span>주변 동종 가게 리뷰 · 한 줄에 하나</span><textarea rows={12} value={nearbyText} onChange={(event) => setNearbyText(event.target.value)} placeholder={'커피 맛은 좋지만 대기가 오래 걸려요\n공간이 깨끗하고 조용해요'} /></label>
        </div>
        <div className="review-rights">
          <label><input type="checkbox" checked={ownershipConfirmed} onChange={(event) => setOwnershipConfirmed(event.target.checked)} /> 나는 이 가게의 소유자·관리자이거나 분석을 위임받았습니다.</label>
          <label><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> 입력할 리뷰의 분석·이용 권한을 확인했고 작성자 이름 등 개인 식별정보를 제외했습니다.</label>
          <p>입력 내용은 저장하지 않습니다. 전화번호·이메일·링크·계정명은 서버에서 한 번 더 제거합니다.</p>
        </div>
        <div className="review-submit"><p>각 그룹 5개 이상부터 실행 아이디어를 제공합니다. 표본 수와 비교 기준을 결과에 함께 표시합니다.</p><button type="submit" disabled={loading || !ownershipConfirmed || !rightsConfirmed}>{loading ? "비식별 분석 중" : "주제별 비교 분석 →"}</button></div>
      </form>
      {error ? <p className="error-banner">{error}</p> : null}
      {result ? <section className="review-results" aria-live="polite">
        <div className="review-summary"><div><p className="eyebrow">USER-PROVIDED · RIGHTS CONFIRMED</p><h2>{result.own_shop_name} vs. 주변 비교군</h2><p>{result.comparison_scope} · {result.period_label}</p></div><div><strong>{result.own_sample_count}</strong><span>내 가게 표본</span></div><div><strong>{result.nearby_sample_count}</strong><span>주변 표본</span></div></div>
        {result.status === "insufficient_sample" ? <div className="sample-warning">표본 부족 · {result.notice}</div> : null}
        <div className="topic-table"><div className="topic-row topic-head"><span>주제</span><span>{result.own_shop_name}</span><span>주변 비교군</span></div>
          {result.topics.map((topic) => <div className="topic-row" id={`review-topic-${topic.topic_key}`} key={topic.topic_key}>
            <strong>{topic.label}</strong><span><small className="topic-side-label">{result.own_shop_name}</small>{topic.own.mentions}회 · 긍정 {topic.own.positive} / 부정 {topic.own.negative}</span><span><small className="topic-side-label">주변 비교군</small>{topic.nearby.mentions}회 · 긍정 {topic.nearby.positive} / 부정 {topic.nearby.negative}</span>
            <details className="review-evidence"><summary>비식별 근거 보기</summary><div><div><b>{result.own_shop_name}</b>{topic.own.evidence.length ? topic.own.evidence.map((item) => <p key={item.review_index}>#{item.review_index} · {sentimentLabel[item.sentiment]} · {item.snippet}</p>) : <p>해당 주제 근거 없음</p>}</div><div><b>주변 비교군</b>{topic.nearby.evidence.length ? topic.nearby.evidence.map((item) => <p key={item.review_index}>#{item.review_index} · {sentimentLabel[item.sentiment]} · {item.snippet}</p>) : <p>해당 주제 근거 없음</p>}</div></div></details>
          </div>)}
        </div>
        <div className="insight-grid">{result.insights.map((insight) => <article className={insight.kind} key={`${insight.topic_key}-${insight.kind}`}><p className="eyebrow">{insight.kind === "strength" ? "관찰된 강점" : "확인할 주의점"}</p><h3>{insight.observation}</h3><p><b>실행 아이디어</b>{insight.action_idea}</p><a href={`#review-topic-${insight.topic_key}`}>집계·근거 보기 ↑</a></article>)}</div>
        <p className="review-notice">{result.notice} 감정 분류는 공개된 단순 키워드 규칙이므로 문맥을 완전히 이해하지 못할 수 있습니다.</p>
      </section> : null}
    </main>
  </div>;
}
