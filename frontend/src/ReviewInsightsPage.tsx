import { FormEvent, useState } from "react";

import { analyzeReviewText } from "./api";
import type { ReviewAnalysisResponse } from "./types";

const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

export function ReviewInsightsPage() {
  const [shopName, setShopName] = useState("내 가게");
  const [scope, setScope] = useState("반경 500m 동종 가게");
  const [period, setPeriod] = useState("최근 3개월");
  const [ownText, setOwnText] = useState("");
  const [nearbyText, setNearbyText] = useState("");
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      setResult(await analyzeReviewText({ own_shop_name: shopName, comparison_scope: scope, period_label: period, own_reviews: lines(ownText), nearby_reviews: lines(nearbyText) }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "리뷰 분석을 완료하지 못했습니다.");
    }
  };

  return <div className="reviews-page">
    <header className="site-header"><a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a><div className="header-context"><a href="#top">상권 탐색</a><strong>개업 후 운영</strong></div></header>
    <main>
      <section className="reviews-hero"><p className="eyebrow">POST-LAUNCH · REVIEWS</p><h1>리뷰를 세지 말고,<br /><em>운영 질문</em>으로 바꿉니다.</h1><p>내 가게와 내가 정한 주변 동종 가게의 리뷰를 같은 기준으로 비교합니다. 리뷰 작성자 정보는 받지 않고 입력 내용은 저장하지 않습니다.</p></section>
      <form className="reviews-form" onSubmit={submit}>
        <div className="review-context">
          <label><span>내 가게 표시명</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} /></label>
          <label><span>비교 범위</span><input value={scope} onChange={(event) => setScope(event.target.value)} /></label>
          <label><span>리뷰 기간</span><input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
        </div>
        <div className="review-inputs">
          <label><span>내 가게 리뷰 · 한 줄에 하나</span><textarea rows={12} value={ownText} onChange={(event) => setOwnText(event.target.value)} placeholder={'커피가 맛있고 직원이 친절해요\n가격이 조금 비싸요'} /></label>
          <label><span>주변 동종 가게 리뷰 · 한 줄에 하나</span><textarea rows={12} value={nearbyText} onChange={(event) => setNearbyText(event.target.value)} placeholder={'커피 맛은 좋지만 대기가 오래 걸려요\n공간이 깨끗하고 조용해요'} /></label>
        </div>
        <div className="review-submit"><p>각 그룹 5개 이상부터 실행 아이디어를 제공합니다. 플랫폼 약관상 사용 권한이 있는 리뷰만 입력하세요.</p><button type="submit">주제별 비교 분석 →</button></div>
      </form>
      {error ? <p className="error-banner">{error}</p> : null}
      {result ? <section className="review-results" aria-live="polite">
        <div className="review-summary"><div><p className="eyebrow">ANALYSIS</p><h2>{result.own_shop_name} vs. 주변 비교군</h2><p>{result.comparison_scope} · {result.period_label}</p></div><div><strong>{result.own_sample_count}</strong><span>내 가게 표본</span></div><div><strong>{result.nearby_sample_count}</strong><span>주변 표본</span></div></div>
        {result.status === "insufficient_sample" ? <div className="sample-warning">표본 부족 · {result.notice}</div> : null}
        <div className="topic-table"><div className="topic-row topic-head"><span>주제</span><span>{result.own_shop_name}</span><span>주변 비교군</span></div>
          {result.topics.map((topic) => <div className="topic-row" key={topic.topic_key}><strong>{topic.label}</strong><span>{topic.own.mentions}회 · 긍정 {topic.own.positive} / 부정 {topic.own.negative}</span><span>{topic.nearby.mentions}회 · 긍정 {topic.nearby.positive} / 부정 {topic.nearby.negative}</span></div>)}
        </div>
        <div className="insight-grid">{result.insights.map((insight) => <article className={insight.kind} key={`${insight.topic_key}-${insight.kind}`}><p className="eyebrow">{insight.kind === "strength" ? "관찰된 강점" : "확인할 주의점"}</p><h3>{insight.observation}</h3><p><b>실행 아이디어</b>{insight.action_idea}</p></article>)}</div>
        <p className="review-notice">{result.notice} 감정 분류는 공개된 단순 키워드 규칙이므로 문맥을 완전히 이해하지 못할 수 있습니다.</p>
      </section> : null}
    </main>
  </div>;
}
