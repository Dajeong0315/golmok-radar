import { TopNavigation } from "./TopNavigation";
import "./home.css";

const steps = [
  { title: "내 조건부터 정리해요", text: "6개의 질문으로 원하는 손님과 운영 방식, 시작 비용을 생각해 보세요.", href: "#quiz", action: "창업 성향 정리하기" },
  { title: "궁금한 골목을 비교해요", text: "서울 공식 상권을 둘러보고, 관심 있는 2~4곳의 통계를 같은 기준으로 비교해요.", href: "#explore", action: "상권 탐색하기" },
  { title: "실제 매물을 확인해요", text: "직접 찾은 매물의 비용과 현장 상태를 기록하고, 더 확인할 항목을 정리해요.", href: "#worksheet", action: "매물 검증하기" },
  { title: "다음 준비를 이어가요", text: "공식 지원 정보를 살펴보고, 계약 전에는 기관과 전문가에게 확인하세요.", href: "#funding", action: "공식 정보 살펴보기" },
];

export function HomePage() {
  return <div className="home-page">
    <header className="site-header home-header">
      <a className="brand" href="#home" aria-label="골목 레이더 홈"><span className="brand-mark">G</span><span>골목 레이더</span></a>
      <TopNavigation active="workflow" />
    </header>
    <main id="home">
      <section className="home-hero">
        <p className="eyebrow">나의 첫 가게, 시작을 위한 탐색</p>
        <h1>궁금한 골목에서,<br /><em>내 가게의 첫걸음.</em></h1>
        <p className="home-lead">어디서 시작할지 막막하다면.<br />내 조건을 정리하고, 상권을 비교하고,<br className="mobile-break" /> 직접 확인할 일까지 함께 찾아보세요.</p>
        <div className="home-actions"><a className="primary-action" href="#quiz">내 창업 조건 정리하기 <span aria-hidden="true">→</span></a><a className="home-secondary" href="#explore">상권 바로 탐색하기</a></div>
        <p className="home-caption">로그인 없이 둘러볼 수 있어요 · 서울 공식 상권 100개 업종</p>
        <div className="home-journey" aria-label="조건 정리에서 상권 비교, 매물 확인까지"><span>01 <b>내 조건</b></span><i aria-hidden="true">→</i><span>02 <b>상권 비교</b></span><i aria-hidden="true">→</i><span>03 <b>매물 확인</b></span></div>
      </section>

      <section className="home-section home-values" aria-labelledby="home-values-title">
        <p className="eyebrow">결정 전에, 확인할 수 있도록</p><h2 id="home-values-title">흩어진 고민을<br />하나씩 구체적으로.</h2>
        <div className="home-value-grid">
          <article><span className="home-symbol" aria-hidden="true">01</span><h3>나만의 시작 기준</h3><p>원하는 손님, 운영 방식, 비용.<br />막연한 아이디어를 질문으로 정리해요.</p></article>
          <article><span className="home-symbol" aria-hidden="true">02</span><h3>같은 기준의 상권 비교</h3><p>매출과 유동인구를 나란히 보고,<br />숫자의 출처와 계산 근거까지 확인해요.</p></article>
          <article><span className="home-symbol" aria-hidden="true">03</span><h3>현장으로 이어지는 준비</h3><p>통계만으로 알 수 없는 매물 비용과<br />시설, 계약 전 확인할 일을 남겨요.</p></article>
        </div>
      </section>

      <section className="home-section home-workflow" id="workflow" aria-labelledby="home-workflow-title">
        <div><p className="eyebrow">HOW IT WORKS</p><h2 id="home-workflow-title">지금 필요한 단계부터<br />시작해도 괜찮아요.</h2><p className="home-section-copy">모든 단계를 순서대로 마칠 필요는 없어요.</p></div>
        <ol>{steps.map((step, index) => <li key={step.href}><span className="home-step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p><a href={step.href}>{step.action} <span aria-hidden="true">↗</span></a></div></li>)}</ol>
      </section>

      <section className="home-section home-example" aria-labelledby="home-example-title">
        <div><p className="eyebrow">이렇게 확인해요</p><h2 id="home-example-title">숫자를 보고,<br />그 근거까지.</h2><p className="home-section-copy">상권을 선택하면 매출 비중과 시간대별 유동인구를 볼 수 있어요. 비교표에서는 원천값과 계산식을 함께 확인하세요.</p><a className="home-secondary" href="#explore">직접 상권 살펴보기 →</a></div>
        <article className="home-example-card"><span className="home-example-tag">상권 정보 구성 예시</span><h3>성수역</h3><p>성동구 · 발달상권 · 커피-음료</p><dl><div><dt>기준기간</dt><dd>2025년 4분기</dd></div><div><dt>어떤 날에 매출이 발생할까?</dt><dd>주중·주말 매출 비중</dd></div><div><dt>언제 사람들이 오갈까?</dt><dd>시간대별 유동인구 분포</dd></div><div><dt>숫자는 어디서 왔을까?</dt><dd>원천값 · 출처 · 계산식</dd></div></dl><small>서울시 상권분석서비스의 상권 단위 통계입니다.<br />실제 수치는 탐색·비교 화면에서 확인할 수 있어요.</small></article>
      </section>

      <section className="home-section home-trust"><p className="eyebrow">골목 레이더의 약속</p><h2>판단의 근거를 더하고,<br />결정은 당신에게.</h2><p>공식 데이터의 기준분기와 출처를 밝히고,<br />없는 수치는 0 대신 ‘비교 불가’로 표시합니다.</p><p>상권 통계는 개별 가게의 매출이나 창업 성공을 보장하지 않아요.<br />현장과 계약 조건은 직접 확인하고 전문가의 도움을 받으세요.</p></section>
      <section className="home-section home-start"><h2>첫걸음, 가볍게 시작해 볼까요?</h2><p>관심 상권과 매물 기록은 카카오 로그인으로 계정에 저장할 수 있어요.</p><a className="primary-action" href="#quiz">내 창업 조건 정리하기 <span aria-hidden="true">→</span></a><a className="home-secondary" href="#explore">상권부터 둘러보기</a></section>
    </main>
    <footer className="home-footer"><a className="brand" href="#home">골목 레이더</a><p>서울 공식 상권 · 같은 기준의 비교 · 모든 수치의 근거</p><p>개업 후 리뷰 분석은 준비 중입니다.</p></footer>
  </div>;
}
