import { TopNavigation } from "./TopNavigation";
import "./home.css";

const steps = [
  { title: "내 조건부터 정리해요", text: "6개의 질문으로 원하는 손님과 운영 방식, 시작 비용을 생각해 보세요.", href: "#quiz", action: "창업 성향 정리하기" },
  { title: "궁금한 골목을 비교해요", text: "서울 공식 상권을 둘러보고, 관심 있는 2~4곳의 통계를 같은 기준으로 비교해요.", href: "#explore", action: "상권 탐색하기" },
  { title: "실제 매물을 확인해요", text: "직접 찾은 매물의 비용과 현장 상태를 기록하고, 더 확인할 항목을 정리해요.", href: "#worksheet", action: "매물 검증하기" },
  { title: "다음 준비를 이어가요", text: "공식 지원 정보를 살펴보고, 계약 전에는 기관과 전문가에게 확인하세요.", href: "#funding", action: "공식 정보 살펴보기" },
];

function AlleyMap() {
  return <figure className="alley-map">
    <svg viewBox="0 0 560 460" role="img" aria-labelledby="alley-map-title alley-map-desc">
      <title id="alley-map-title">골목 지도 위의 공식 상권 예시</title>
      <desc id="alley-map-desc">골목길 사이에 노란색으로 표시한 공식 상권 세 곳과, 그중 한 곳을 중심으로 퍼지는 레이더 원을 그린 예시 그림입니다.</desc>
      <rect className="alley-map__land" width="560" height="460" rx="14" />
      <g className="alley-map__blocks">
        <rect x="24" y="22" width="120" height="96" rx="6" /><rect x="166" y="18" width="128" height="104" rx="6" /><rect x="372" y="20" width="164" height="88" rx="6" />
        <rect x="26" y="190" width="104" height="112" rx="6" /><rect x="388" y="176" width="146" height="120" rx="6" />
        <rect x="28" y="352" width="140" height="86" rx="6" /><rect x="196" y="336" width="84" height="104" rx="6" /><rect x="372" y="352" width="160" height="88" rx="6" />
      </g>
      <g className="alley-map__alleys">
        <path d="M0 148 C 120 152, 220 136, 560 142" /><path d="M0 322 C 160 330, 300 314, 560 326" />
        <path d="M156 0 C 150 120, 168 260, 152 460" /><path d="M356 0 C 362 140, 346 300, 360 460" />
        <path d="M156 236 L 356 252" /><path d="M250 142 L 238 326" /><path d="M356 220 L 560 214" /><path d="M64 148 L 70 322" /><path d="M454 326 L 448 460" />
      </g>
      <g className="alley-map__roads">
        <path d="M-10 140 C 140 150, 260 128, 570 136" /><path d="M300 -10 C 306 160, 286 300, 298 470" />
      </g>
      <g className="alley-map__radar" aria-hidden="true">
        <circle cx="236" cy="208" r="46" /><circle cx="236" cy="208" r="96" /><circle cx="236" cy="208" r="150" />
        <path className="alley-map__sweep" d="M236 208 L 236 58 A 150 150 0 0 1 366 133 Z" />
      </g>
      <g className="alley-map__areas">
        <path className="area-a" d="M182 162 L 286 154 L 304 230 L 262 262 L 188 250 Z" />
        <path className="area-b" d="M70 342 L 176 334 L 186 420 L 84 432 Z" />
        <path className="area-c" d="M392 176 L 520 168 L 532 268 L 444 296 L 398 262 Z" />
      </g>
      <g className="alley-map__tags">
        <g transform="translate(196 176)"><rect width="62" height="26" rx="5" /><text x="31" y="17.5">상권 A</text></g>
        <g transform="translate(96 364)"><rect width="62" height="26" rx="5" /><text x="31" y="17.5">상권 B</text></g>
        <g transform="translate(428 200)"><rect width="62" height="26" rx="5" /><text x="31" y="17.5">상권 C</text></g>
      </g>
    </svg>
    <figcaption><span className="legend-swatch" aria-hidden="true" />노란 영역은 서울시 상권분석서비스의 공식 상권 경계입니다. 그림은 이해를 돕기 위한 예시예요.</figcaption>
  </figure>;
}

export function HomePage() {
  return <div className="home-page">
    <header className="site-header home-header">
      <a className="brand" href="#home" aria-label="골목 레이더 홈"><span className="brand-mark">G</span><span>골목 레이더</span></a>
      <TopNavigation active="workflow" />
    </header>
    <main id="home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="home-hero__scope">서울 25개 자치구, 공식 상권 1,650곳, 100개 업종</p>
          <h1 id="home-title">궁금한 골목에서,<br />내 가게의 첫걸음.</h1>
          <p className="home-lead">어디서 시작할지 막막하다면 내 조건을 정리하고, 상권을 같은 기준으로 비교하고, 직접 확인할 일까지 함께 찾아보세요.</p>
          <div className="home-actions">
            <a className="primary-action" href="#quiz">내 창업 조건 정리하기</a>
            <a className="home-text-link" href="#explore">상권 바로 탐색하기</a>
          </div>
          <p className="home-caption">로그인 없이 둘러볼 수 있어요. 기준기간은 2025년 4분기입니다.</p>
        </div>
        <AlleyMap />
      </section>

      <section className="home-section home-values" aria-labelledby="home-values-title">
        <h2 id="home-values-title">흩어진 고민을<br />하나씩 구체적으로.</h2>
        <div className="home-value-grid">
          <article>
            <svg className="home-glyph" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="17" r="10" /><circle className="fill-ink" cx="20" cy="17" r="3.5" /><path d="M20 27 L 20 36" /></svg>
            <h3>나만의 시작 기준</h3>
            <p>원하는 손님, 운영 방식, 비용. 막연한 아이디어를 질문으로 정리해요.</p>
          </article>
          <article>
            <svg className="home-glyph" viewBox="0 0 40 40" aria-hidden="true"><path className="fill-lane" d="M4 10 L 22 7 L 25 24 L 7 28 Z" /><path className="fill-lane" d="M17 16 L 35 13 L 37 32 L 19 34 Z" /></svg>
            <h3>같은 기준의 상권 비교</h3>
            <p>매출과 유동인구를 나란히 보고, 숫자의 출처와 계산 근거까지 확인해요.</p>
          </article>
          <article>
            <svg className="home-glyph" viewBox="0 0 40 40" aria-hidden="true"><path className="dashed" d="M4 34 C 12 34, 10 20, 20 20 S 28 6, 36 6" /><circle className="fill-ink" cx="36" cy="6" r="3.5" /></svg>
            <h3>현장으로 이어지는 준비</h3>
            <p>통계만으로 알 수 없는 매물 비용과 시설, 계약 전 확인할 일을 남겨요.</p>
          </article>
        </div>
      </section>

      <section className="home-section home-workflow" id="workflow" aria-labelledby="home-workflow-title">
        <div className="home-workflow__intro">
          <h2 id="home-workflow-title">지금 필요한 단계부터<br />시작해도 괜찮아요.</h2>
          <p className="home-section-copy">네 정거장은 권장 순서일 뿐, 모든 단계를 순서대로 마칠 필요는 없어요.</p>
        </div>
        <ol className="home-route">{steps.map((step, index) => <li key={step.href}>
          <span className="home-route__stop" aria-hidden="true">{index + 1}</span>
          <div><h3>{step.title}</h3><p>{step.text}</p><a href={step.href}>{step.action}</a></div>
        </li>)}</ol>
      </section>

      <section className="home-section home-example" aria-labelledby="home-example-title">
        <div>
          <h2 id="home-example-title">숫자를 보고,<br />그 근거까지.</h2>
          <p className="home-section-copy">상권을 선택하면 매출 비중과 시간대별 유동인구를 볼 수 있어요. 비교표에서는 원천값과 계산식을 함께 확인하세요.</p>
          <a className="home-text-link" href="#explore">직접 상권 살펴보기</a>
        </div>
        <article className="home-example-card" aria-label="상권 정보 구성 예시">
          <svg className="home-example-card__shape" viewBox="0 0 80 64" aria-hidden="true"><path d="M8 12 L 56 6 L 72 38 L 46 58 L 12 50 Z" /></svg>
          <p className="home-example-tag">상권 정보 구성 예시</p>
          <h3>성수역</h3>
          <p className="home-example-meta">성동구, 발달상권, 커피-음료</p>
          <dl>
            <div><dt>기준기간</dt><dd>2025년 4분기</dd></div>
            <div><dt>어떤 날에 매출이 발생할까?</dt><dd>주중과 주말 매출 비중</dd></div>
            <div><dt>언제 사람들이 오갈까?</dt><dd>시간대별 유동인구 분포</dd></div>
            <div><dt>숫자는 어디서 왔을까?</dt><dd>원천값, 출처, 계산식</dd></div>
          </dl>
          <small>서울시 상권분석서비스의 상권 단위 통계입니다. 실제 수치는 탐색·비교 화면에서 확인할 수 있어요.</small>
        </article>
      </section>

      <section className="home-section home-trust" aria-labelledby="home-trust-title">
        <h2 id="home-trust-title">판단의 근거를 더하고,<br />결정은 당신에게.</h2>
        <div>
          <p>공식 데이터의 기준분기와 출처를 밝히고, 없는 수치는 0 대신 ‘비교 불가’와 그 사유로 표시합니다.</p>
          <table className="home-trust__specimen">
            <caption>비교표에서 없는 값을 표시하는 방식</caption>
            <thead><tr><th scope="col">지표</th><th scope="col">상권 A</th><th scope="col">상권 B</th></tr></thead>
            <tbody>
              <tr><th scope="row">점포 수</th><td>원천값</td><td>원천값</td></tr>
              <tr><th scope="row">추정 매출</th><td>원천값</td><td className="is-unavailable">비교 불가<small>해당 업종의 매출 원천 미제공</small></td></tr>
            </tbody>
          </table>
          <p>상권 통계는 개별 가게의 매출이나 창업 성공을 보장하지 않아요. 현장과 계약 조건은 직접 확인하고 전문가의 도움을 받으세요.</p>
        </div>
      </section>

      <section className="home-start" aria-labelledby="home-start-title">
        <div>
          <h2 id="home-start-title">첫걸음, 가볍게 시작해 볼까요?</h2>
          <p>관심 상권과 매물 기록은 카카오 로그인으로 계정에 저장할 수 있어요.</p>
        </div>
        <div className="home-start__actions">
          <a className="primary-action" href="#quiz">내 창업 조건 정리하기</a>
          <a className="home-text-link" href="#explore">상권부터 둘러보기</a>
        </div>
      </section>
    </main>
    <footer className="home-footer">
      <a className="brand" href="#home"><span className="brand-mark" aria-hidden="true">G</span><span>골목 레이더</span></a>
      <p>서울 공식 상권을 같은 기준으로 비교하고, 모든 수치의 근거를 밝힙니다.</p>
      <p>개업 후에는 공개 리뷰 표본으로 내 가게와 주변 반응을 비교해 볼 수 있어요.</p>
    </footer>
  </div>;
}
