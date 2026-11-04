import { FormEvent, useEffect, useState } from "react";

import { analyzeReviewText, fetchReviewCaptureStatus } from "./api";
import { TopNavigation } from "./TopNavigation";
import type { ReviewAnalysisResponse, ReviewCaptureStatus } from "./types";

const toLines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

export function ReviewInsightsPage() {
  const [capture, setCapture] = useState<ReviewCaptureStatus | null>(null);
  const [captureError, setCaptureError] = useState("");
  const [ownReviews, setOwnReviews] = useState("");
  const [nearbyReviews, setNearbyReviews] = useState("");
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchReviewCaptureStatus(controller.signal).then(setCapture).catch((reason: Error) => setCaptureError(reason.message));
    return () => controller.abort();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const own = toLines(ownReviews);
    const nearby = toLines(nearbyReviews);
    if (!own.length || !nearby.length) {
      setError("내 가게와 주변 비교군 리뷰를 각각 한 줄 이상 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      setResult(await analyzeReviewText({
        own_shop_name: "내 가게",
        comparison_scope: "주변 동종 가게 익명 비교군",
        period_label: "제한 표본",
        ownership_confirmed: true,
        data_rights_confirmed: true,
        own_reviews: own,
        nearby_reviews: nearby,
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "리뷰 분석을 완료하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const providerSummary = capture && Object.entries(capture.provider_counts).map(([provider, count]) => `${provider === "kakao" ? "카카오" : "네이버"} ${count}건`).join(" · ");

  return <div className="reviews-page">
    <header className="site-header">
      <a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a>
      <TopNavigation active="reviews" />
      <div className="header-context"><strong>개업 후 운영</strong></div>
    </header>
    <main>
      <section className="reviews-hero">
        <p className="eyebrow">PHASE 17 · 제한 표본 리뷰 분석</p>
        <h1>손님 반응을<br /><em>같은 기준</em>으로 살펴보세요.</h1>
        <p>내 가게와 주변 동종 가게의 공개 리뷰 표본을 메뉴·가격·응대·공간 기준으로 비교합니다. 실제 상호와 원문은 화면에 노출하지 않습니다.</p>
      </section>

      <section className="review-coming" aria-labelledby="capture-title">
        <div className="review-section-heading">
          <div><p className="eyebrow">현재 수집 상태</p><h2 id="capture-title">암호화된 제한 표본</h2></div>
          <p>상권별 월 1회, 최대 5개 가게와 가게당 20개 리뷰만 수집합니다.</p>
        </div>
        <div className="review-provider-status">
          {capture?.status === "available" ? <><strong>{capture.review_count}건 수집 완료</strong><p>{providerSummary || "제공자 정보 없음"} · 수집 시각 {new Date(capture.captured_at || "").toLocaleString("ko-KR")}<br />원문은 암호화 저장되며, 이 화면에는 집계 결과만 표시합니다.</p></> : <><strong>수집 대기</strong><p>{captureError || "아직 확인할 수집 표본이 없습니다."}</p></>}
        </div>
      </section>

      <form className="reviews-form" onSubmit={submit}>
        <div className="review-section-heading">
          <div><p className="eyebrow">분석 미리보기</p><h2>비식별 리뷰 비교</h2></div>
          <p>개발 확인용 입력입니다. 한 줄에 리뷰 하나씩 넣으면 서버에서 개인 식별 단서를 다시 제거하고 분석합니다.</p>
        </div>
        <div className="review-inputs">
          <label><span>내 가게 리뷰</span><textarea rows={8} value={ownReviews} onChange={(event) => setOwnReviews(event.target.value)} placeholder={"커피가 맛있고 직원이 친절해요\n공간이 깨끗해요"} /></label>
          <label><span>주변 익명 비교군 리뷰</span><textarea rows={8} value={nearbyReviews} onChange={(event) => setNearbyReviews(event.target.value)} placeholder={"메뉴는 좋지만 대기가 길어요\n가격은 조금 비싸지만 분위기가 좋아요"} /></label>
        </div>
        <div className="review-submit"><p>비교군 상호는 A, B, C처럼 가명으로만 관리합니다. 각 그룹 5건 이상부터 실행 아이디어를 제공합니다.</p><button type="submit" disabled={loading}>{loading ? "분석 중" : "주제별 비교 분석"}</button></div>
        {error ? <p className="error-banner">{error}</p> : null}
      </form>

      {result ? <section className="review-results" aria-live="polite">
        <div className="review-summary"><div><p className="eyebrow">분석 결과</p><h2>주제별 언급을<br />확인해 보세요.</h2><p>{result.notice}</p></div><div><strong>{result.own_sample_count}</strong><span>내 가게 표본</span></div><div><strong>{result.nearby_sample_count}</strong><span>주변 표본</span></div></div>
        {result.status === "insufficient_sample" ? <p className="sample-warning">표본 부족: 각 그룹 5건 이상이 모이면 실행 아이디어를 제공합니다.</p> : null}
        <div className="topic-cards">{result.topics.map((topic) => <article className="topic-card" key={topic.topic_key}><header><div><span>주제</span><h3>{topic.label}</h3></div></header><div className="topic-comparison"><div><small>내 가게</small><strong>{topic.own.mentions}회 언급</strong><p>긍정 {topic.own.positive} · 부정 {topic.own.negative} · 중립 {topic.own.neutral}</p></div><div><small>주변 A/B/C</small><strong>{topic.nearby.mentions}회 언급</strong><p>긍정 {topic.nearby.positive} · 부정 {topic.nearby.negative} · 중립 {topic.nearby.neutral}</p></div></div></article>)}</div>
      </section> : null}
    </main>
  </div>;
}
