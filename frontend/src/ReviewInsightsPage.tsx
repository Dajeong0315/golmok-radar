import { FormEvent, useState } from "react";

import { analyzeReviewText } from "./api";
import { searchKakaoPlaces, selectNearbyPlaces, type KakaoPlace } from "./kakaoPlaces";
import type { ReviewAnalysisResponse } from "./types";

const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const sentimentLabel = { positive: "긍정", negative: "부정", neutral: "중립" } as const;

export function ReviewInsightsPage() {
  const [shopName, setShopName] = useState("내 가게");
  const [industry, setIndustry] = useState("카페");
  const [radius, setRadius] = useState(500);
  const [shopCount, setShopCount] = useState(3);
  const [period, setPeriod] = useState("최근 3개월");
  const [shopQuery, setShopQuery] = useState("");
  const [shopResults, setShopResults] = useState<KakaoPlace[]>([]);
  const [selectedShop, setSelectedShop] = useState<KakaoPlace | null>(null);
  const [nearbyShops, setNearbyShops] = useState<KakaoPlace[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [ownText, setOwnText] = useState("");
  const [nearbyText, setNearbyText] = useState("");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const reportLead = result?.insights[0]?.observation || (result?.status === "insufficient_sample"
    ? "아직 결론을 내리기에는 리뷰가 부족해요."
    : "이번 표본에서는 내 가게와 주변의 큰 차이가 뚜렷하지 않아요.");
  const reportAction = result?.insights[0]?.action_idea || (result?.status === "insufficient_sample"
    ? "리뷰가 더 모이면 실행 아이디어를 보여드릴게요."
    : "주제별 숫자와 리뷰 근거를 확인하며 작은 차이를 찾아보세요.");

  const searchOwnShop = async () => {
    if (!shopQuery.trim()) return;
    setPlaceLoading(true);
    setPlaceError("");
    try {
      const places = await searchKakaoPlaces(shopQuery.trim());
      setShopResults(places);
      if (!places.length) setPlaceError("검색 결과가 없습니다. 가게 이름과 지역을 함께 입력해 보세요.");
    } catch (reason) {
      setPlaceError(reason instanceof Error ? reason.message : "가게를 검색하지 못했습니다.");
    } finally {
      setPlaceLoading(false);
    }
  };

  const chooseShop = async (place: KakaoPlace) => {
    setSelectedShop(place);
    setShopName(place.name);
    setShopResults([]);
    setPlaceLoading(true);
    setPlaceError("");
    try {
      const places = await searchKakaoPlaces(industry, {
        latitude: place.latitude,
        longitude: place.longitude,
        radius,
      });
      setNearbyShops(selectNearbyPlaces(places, place.id, shopCount));
    } catch (reason) {
      setNearbyShops([]);
      setPlaceError(reason instanceof Error ? reason.message : "주변 가게를 찾지 못했습니다.");
    } finally {
      setPlaceLoading(false);
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
        comparison_scope: `반경 ${radius}m · ${industry} · 자동 선택한 ${nearbyShops.length || shopCount}곳`,
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
      <section className="reviews-hero"><p className="eyebrow">가게를 연 뒤 · 리뷰 보기</p><h1>손님 리뷰에서<br />다음에 고칠 일을 찾아보세요.</h1><p>내 가게를 찾으면 같은 업종의 가까운 가게를 자동으로 골라요.<br />허가된 리뷰 데이터만 연결해 메뉴, 가격, 응대처럼 같은 기준으로 비교합니다.</p></section>
      <section className="shop-finder" aria-labelledby="shop-finder-title">
        <div className="review-section-heading"><div><p className="eyebrow">1 · 내 가게 선택</p><h2 id="shop-finder-title">가게 이름을 검색하세요</h2></div><p>지역 이름을 함께 입력하면 더 정확해요. 선택한 가게를 기준으로 같은 업종의 가까운 가게를 자동으로 찾습니다.</p></div>
        <div className="shop-search"><label><span className="sr-only">내 가게 검색</span><input value={shopQuery} onChange={(event) => setShopQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchOwnShop(); } }} placeholder="예: 성수동 골목 카페" /></label><button type="button" onClick={() => void searchOwnShop()} disabled={placeLoading}>{placeLoading ? "찾는 중" : "가게 찾기"}</button></div>
        {placeError ? <p className="error-banner">{placeError}</p> : null}
        {shopResults.length ? <div className="shop-search-results" aria-label="가게 검색 결과">{shopResults.map((place) => <button type="button" key={place.id} onClick={() => void chooseShop(place)}><strong>{place.name}</strong><span>{place.roadAddress || place.address}</span><small>{place.category}</small></button>)}</div> : null}
        {selectedShop ? <div className="selected-shop-panel"><div><p className="eyebrow">선택한 내 가게</p><h3>{selectedShop.name}</h3><p>{selectedShop.roadAddress || selectedShop.address}</p><a href={selectedShop.placeUrl} target="_blank" rel="noreferrer">카카오맵에서 확인 ↗</a></div><div><p className="eyebrow">자동 선택한 주변 가게 {nearbyShops.length}곳</p>{nearbyShops.length ? <ol>{nearbyShops.map((place) => <li key={place.id}><span>{place.name}</span><small>{place.distance === null ? place.category : `${place.distance.toLocaleString("ko-KR")}m · ${place.category}`}</small></li>)}</ol> : <p>조건에 맞는 주변 가게를 찾지 못했습니다.</p>}</div></div> : null}
        {selectedShop ? <div className="review-provider-status"><strong>장소 선택 완료</strong><p>리뷰 원문 자동 수집은 분석·재사용 권한이 확인된 제공자 연결이 필요합니다. 네이버·카카오 지도 화면을 임의로 크롤링하지 않습니다.</p></div> : null}
      </section>
      <form className="reviews-form" onSubmit={submit}>
        <div className="review-section-heading"><div><p className="eyebrow">2 · 리뷰 연결</p><h2>리뷰 데이터 준비</h2></div><p>정식 제공자가 연결되면 선택한 가게와 주변 가게의 리뷰가 이 단계에 자동으로 들어옵니다.</p></div>
        <div className="review-context">
          <label><span>내 가게 표시명</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} /></label>
          <label><span>비교 업종</span><input value={industry} onChange={(event) => setIndustry(event.target.value)} /></label>
          <label><span>리뷰 기간</span><input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          <label><span>비교 반경(m)</span><input type="number" min="100" max="5000" value={radius} onChange={(event) => setRadius(Number(event.target.value))} /></label>
          <label><span>주변 비교 가게 수</span><input type="number" min="1" max="20" value={shopCount} onChange={(event) => setShopCount(Number(event.target.value))} /></label>
        </div>
        <details className="review-manual-fallback"><summary>제공자 연결 전 개발용 리뷰 입력</summary><p>자동 연동 계약 테스트가 끝날 때까지만 사용하는 임시 입력입니다. 실제 서비스 화면에서는 제거됩니다.</p><div className="review-inputs"><label><span>내 가게 리뷰 · 한 줄에 하나</span><textarea rows={10} value={ownText} onChange={(event) => setOwnText(event.target.value)} placeholder={'커피가 맛있고 직원이 친절해요\n가격이 조금 비싸요'} /></label><label><span>주변 동종 가게 리뷰 · 한 줄에 하나</span><textarea rows={10} value={nearbyText} onChange={(event) => setNearbyText(event.target.value)} placeholder={'커피 맛은 좋지만 대기가 오래 걸려요\n공간이 깨끗하고 조용해요'} /></label></div></details>
        <div className="review-rights">
          <label><input type="checkbox" checked={ownershipConfirmed} onChange={(event) => setOwnershipConfirmed(event.target.checked)} /> 나는 이 가게의 소유자·관리자이거나 분석을 위임받았습니다.</label>
          <label><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /> 입력할 리뷰의 분석·이용 권한을 확인했고 작성자 이름 등 개인 식별정보를 제외했습니다.</label>
          <p>입력 내용은 저장하지 않습니다. 전화번호·이메일·링크·계정명은 서버에서 한 번 더 제거합니다.</p>
        </div>
        <div className="review-submit"><p>각 그룹 5개 이상부터 실행 아이디어를 제공합니다. 표본 수와 비교 기준을 결과에 함께 표시합니다.</p><button type="submit" disabled={loading || !ownershipConfirmed || !rightsConfirmed}>{loading ? "비식별 분석 중" : "주제별 비교 분석 →"}</button></div>
      </form>
      {error ? <p className="error-banner">{error}</p> : null}
      {result ? <section className="review-results" aria-live="polite">
        <div className="review-summary"><div><p className="eyebrow">리뷰 비교 리포트</p><h2>{result.own_shop_name}와<br />주변 가게의 차이</h2><p>{result.comparison_scope} · {result.period_label}</p></div><div><strong>{result.own_sample_count}</strong><span>내 가게 리뷰</span></div><div><strong>{result.nearby_sample_count}</strong><span>주변 가게 리뷰</span></div></div>
        {result.status === "insufficient_sample" ? <div className="sample-warning">표본 부족 · {result.notice}</div> : null}
        <div className="review-report-guide">
          <article><span>01</span><small>먼저 읽기</small><strong>{reportLead}</strong></article>
          <article><span>02</span><small>다음 행동</small><strong>{reportAction}</strong></article>
          <article><span>03</span><small>해석 범위</small><strong>내 가게 {result.own_sample_count}건과 주변 {result.nearby_sample_count}건만 비교했어요.</strong></article>
        </div>
        <div className="review-section-heading"><div><p className="eyebrow">1 · 먼저 읽기</p><h2>지금 눈여겨볼 점</h2></div><p>리뷰에서 반복해서 나타난 차이와 바로 해볼 일을 나눠서 보여드려요.</p></div>
        {result.insights.length ? <div className="insight-grid">{result.insights.map((insight) => <article className={insight.kind} key={`${insight.topic_key}-${insight.kind}`}><span className="insight-badge">{insight.kind === "strength" ? "잘하고 있는 점" : "먼저 확인할 점"}</span><h3>{insight.observation}</h3><div className="insight-action"><small>이렇게 해보세요</small><p>{insight.action_idea}</p></div><a href={`#review-topic-${insight.topic_key}`}>리뷰 숫자와 근거 확인 ↓</a></article>)}</div> : <p className="review-empty-insight">{result.status === "insufficient_sample" ? "리뷰 표본이 더 모이면 잘하고 있는 점과 먼저 확인할 일을 보여드려요." : "이번 표본에서는 큰 차이가 뚜렷하지 않았어요. 아래 주제별 숫자와 리뷰 근거를 확인해 보세요."}</p>}
        <div className="review-section-heading"><div><p className="eyebrow">2 · 숫자로 확인하기</p><h2>주제별 리뷰 비교</h2></div><p>메뉴·가격·응대처럼 손님이 언급한 주제만 모아 내 가게와 주변을 나란히 봅니다.</p></div>
        <div className="topic-cards">
          {result.topics.map((topic) => <article className="topic-card" id={`review-topic-${topic.topic_key}`} key={topic.topic_key}>
            <header><div><span>주제</span><h3>{topic.label}</h3></div><small>내 가게 · 주변 비교</small></header>
            <div className="topic-comparison"><div><small>내 가게</small><strong>{topic.own.mentions}회 언급</strong><p><span className="positive">긍정 {topic.own.positive}</span><span className="negative">부정 {topic.own.negative}</span><span>중립 {topic.own.neutral}</span></p></div><div><small>주변 가게</small><strong>{topic.nearby.mentions}회 언급</strong><p><span className="positive">긍정 {topic.nearby.positive}</span><span className="negative">부정 {topic.nearby.negative}</span><span>중립 {topic.nearby.neutral}</span></p></div></div>
            <details className="review-evidence"><summary>어떤 리뷰에서 나온 숫자인지 보기</summary><div><div><b>{result.own_shop_name}</b>{topic.own.evidence.length ? topic.own.evidence.map((item) => <p key={item.review_index}>#{item.review_index} · {sentimentLabel[item.sentiment]} · {item.snippet}</p>) : <p>이 주제를 언급한 리뷰가 없어요.</p>}</div><div><b>주변 가게</b>{topic.nearby.evidence.length ? topic.nearby.evidence.map((item) => <p key={item.review_index}>#{item.review_index} · {sentimentLabel[item.sentiment]} · {item.snippet}</p>) : <p>이 주제를 언급한 리뷰가 없어요.</p>}</div></div></details>
          </article>)}
        </div>
        <p className="review-notice">{result.notice} 감정 분류는 공개된 단순 키워드 규칙이므로 문맥을 완전히 이해하지 못할 수 있습니다.</p>
      </section> : null}
    </main>
  </div>;
}
