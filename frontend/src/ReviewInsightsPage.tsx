import { TopNavigation } from "./TopNavigation";

export function ReviewInsightsPage() {
  return <div className="reviews-page">
    <header className="site-header">
      <a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a>
      <TopNavigation active="reviews" />
      <div className="header-context"><strong>개업 후 운영</strong></div>
    </header>
    <main>
      <section className="reviews-hero reviews-coming-hero">
        <p className="eyebrow">개업 후 리뷰 분석 · 준비 중</p>
        <span className="coming-soon-badge">COMING SOON</span>
        <h1>리뷰 비교 기능을<br />안전하게 준비하고 있어요.</h1>
        <p>정식으로 사용할 수 있는 리뷰 데이터 제공 업체의 답변을 기다리고 있어요.<br />이용 권한과 데이터 품질을 확인한 뒤 기능을 열겠습니다.</p>
      </section>

      <section className="review-coming" aria-labelledby="review-coming-title">
        <div className="review-section-heading">
          <div><p className="eyebrow">열리면 할 수 있는 일</p><h2 id="review-coming-title">내 가게와 주변 가게를<br />쉽게 비교해 드릴게요.</h2></div>
          <p>처음 가게를 운영하는 분도 이해할 수 있도록 어려운 분석 용어 대신 확인할 점과 다음 행동을 보여드릴 예정입니다.</p>
        </div>
        <ol className="review-coming-steps">
          <li><span>01</span><strong>내 가게 찾기</strong><p>가게를 선택하면 가까운 같은 업종 가게를 자동으로 찾아요.</p></li>
          <li><span>02</span><strong>손님 반응 비교</strong><p>메뉴, 가격, 응대, 대기, 청결, 분위기를 같은 기준으로 살펴봐요.</p></li>
          <li><span>03</span><strong>다음 행동 정리</strong><p>잘하고 있는 점과 먼저 확인할 일을 쉬운 문장으로 알려드려요.</p></li>
        </ol>

        <div className="review-coming-notice">
          <div><span>현재 상태</span><strong>정식 데이터 제휴 답변을 기다리고 있어요.</strong></div>
          <p>지금은 리뷰를 수집하거나 분석하지 않습니다. 네이버·카카오 지도 화면이나 비공개 경로에서 리뷰를 임의로 가져오지 않습니다.</p>
        </div>

        <a className="review-back-link" href="#top">서울 상권 먼저 살펴보기 →</a>
      </section>
    </main>
  </div>;
}
