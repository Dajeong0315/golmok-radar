import { ReviewAutomaticFlow } from "./ReviewAutomaticFlow";
import { TopNavigation } from "./TopNavigation";

export function ReviewInsightsPage() {
  return <div className="reviews-page">
    <header className="site-header">
      <a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a>
      <TopNavigation active="reviews" />
      <div className="header-context"><strong>개업 후 운영</strong></div>
    </header>
    <main>
      <section className="reviews-hero">
        <p className="eyebrow">가게 운영 점검 · 제한 표본 리뷰 분석</p>
        <h1>손님 반응을<br /><em>같은 기준</em>으로 살펴보세요.</h1>
        <p>내 가게를 선택하면 공식 상권을 확인하고, 주변 카페의 공개 리뷰 표본을 메뉴·가격·응대·공간 기준으로 비교합니다. 주변 가게의 실제 상호와 리뷰 원문은 표시하지 않습니다.</p>
      </section>
      <ReviewAutomaticFlow />
    </main>
  </div>;
}
