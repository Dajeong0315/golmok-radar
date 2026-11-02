import { TopNavigation } from "./TopNavigation";

const steps = [
  {
    number: "01",
    stage: "탐색",
    title: "조건을 정리하고, 같은 기준으로 상권을 비교합니다.",
    description: "창업 성향·예산·운영 조건을 정리한 뒤 서울 공식 상권을 찾고, 관심 상권 2~4곳의 카페 지표를 같은 기준분기로 확인합니다.",
    actions: [
      { label: "창업 성향 정리하기", href: "#quiz", note: "선택 · 6문항" },
      { label: "서울 상권 탐색하기", href: "#top", note: "필수 · 관심 상권 저장" },
    ],
    data: "서울시 골목상권 통계 · 상권 코드·업종·기준분기 기준",
  },
  {
    number: "02",
    stage: "검증",
    title: "직접 찾은 매물과 현장을 기록합니다.",
    description: "공식 R-ONE 임대 벤치마크는 참고하되, 보증금·월세·관리비·권리금과 현장 확인 내용은 직접 입력한 매물 후보에만 기록합니다.",
    actions: [
      { label: "매물 검증 워크시트 열기", href: "#worksheet", note: "직접 입력 · 브라우저 저장" },
      { label: "상권 비교 뒤 임대 통계 보기", href: "#top", note: "상권 2곳 이상 선택 후 이용" },
    ],
    data: "R-ONE 공식 분기 통계와 사용자 입력 매물 정보를 분리 표시",
  },
  {
    number: "03",
    stage: "의사결정 준비",
    title: "공식 정보와 남은 확인 항목을 점검합니다.",
    description: "지원·자금 정보는 공식 출처와 확인일을 보고, 건축물 용도·영업 가능 여부·특약·원상복구는 공식 기관 또는 전문가에게 확인합니다.",
    actions: [{ label: "공식 지원·자금 정보 보기", href: "#funding", note: "공식 출처 · 승인 예측 없음" }],
    data: "계약 여부, 법률·세무·중개 판단은 서비스가 제공하지 않음",
  },
  {
    number: "04",
    stage: "운영 개선",
    title: "개업 후에만 고객 반응을 별도로 살펴봅니다.",
    description: "계약 전 판단 흐름과 분리합니다. 리뷰 데이터의 분석·재사용 권한이 확인된 뒤에만 내 가게와 주변 경쟁점의 반응을 비교합니다.",
    actions: [{ label: "리뷰 기능 상태 보기", href: "#reviews", note: "현재 준비 중" }],
    data: "비공개 API·화면 크롤링으로 리뷰를 수집하지 않음",
  },
];

export function WorkflowPage() {
  return <main className="workflow-page">
    <header className="site-header workflow-header"><a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation active="workflow" /><a className="back-link" href="#top">상권 탐색</a></header>
    <section className="workflow-hero"><p className="eyebrow">HOW TO USE GOLMOK RADAR</p><h1>상권을 본 뒤,<br /><em>실제 매물</em>까지 확인하는 순서</h1><p>골목 레이더는 계약이나 창업 결과를 판정하지 않습니다. 같은 기준의 통계, 직접 확인한 매물, 공식 정보의 경계를 나눠 확인 누락을 줄입니다.</p><a className="primary-action" href="#top">상권 탐색부터 시작하기 <span>→</span></a></section>
    <section className="workflow-overview" aria-labelledby="workflow-title"><div><p className="eyebrow">4단계 사용 흐름</p><h2 id="workflow-title">지금 필요한 단계부터 시작하세요.</h2></div><p>각 단계는 완료해야만 다음으로 갈 필요가 없습니다. 다만 수치 비교 뒤에는 현장과 매물을 직접 검증해야 합니다.</p></section>
    <section className="workflow-steps">{steps.map((step) => <article className="workflow-step" key={step.number}><div className="workflow-step__number"><span>{step.number}</span><strong>{step.stage}</strong></div><div className="workflow-step__main"><h2>{step.title}</h2><p>{step.description}</p><div className="workflow-actions">{step.actions.map((action) => <a href={action.href} key={action.href}><span>{action.note}</span>{action.label} <b>→</b></a>)}</div></div><aside><small>데이터·판단 경계</small><p>{step.data}</p></aside></article>)}</section>
    <section className="workflow-reminder"><div><p className="eyebrow">사용 전 기억할 점</p><h2>숫자가 대신 결정하지 않습니다.</h2></div><ul><li>상권 통계는 같은 기준분기의 비교 근거입니다.</li><li>개별 매물의 비용과 현장 상태는 직접 입력·확인합니다.</li><li>계약·인허가 관련 항목은 공식 기관 또는 전문가 확인이 필요합니다.</li></ul></section>
  </main>;
}
