export type FundingStage = "pre_startup" | "existing";

export type BankFundingGuide = {
  id: "ibk-box" | "ibk-startup" | "ibk-jobs" | "kdb-onlending";
  institution: "IBK기업은행" | "KDB산업은행";
  title: string;
  category: string;
  reason: string;
  eligibility: string;
  confirmation: string;
  sourceUrl: string;
  checkedAt: string;
};

export type AdditionalFundingGuide = {
  id: "mss-policy" | "seoul-support" | "kinfa-microfinance" | "kb-policy-loan" | "woori-click";
  institution: string;
  title: string;
  category: "정부 지원·정책자금" | "서울 지원제도" | "조건부 정책금융" | "다른 은행 대출";
  summary: string;
  confirmation: string;
  sourceUrl: string;
  checkedAt: string;
};

const CHECKED_AT = "2026-11-01";

const IBK_BOX: Omit<BankFundingGuide, "reason"> = {
  id: "ibk-box",
  institution: "IBK기업은행",
  title: "IBK 대출통로BOX",
  category: "사업자 대출 확인 경로",
  eligibility: "사업자등록을 마친 개인사업자 또는 법인사업자가 이용할 수 있는 기업대출 확인·신청 경로예요.",
  confirmation: "사업자등록 전에는 신청할 수 없고, 실제 상품·금리·한도는 은행 심사 결과로 결정돼요.",
  sourceUrl: "https://82.ibkbox.net/limit",
  checkedAt: CHECKED_AT,
};

const IBK_STARTUP: Omit<BankFundingGuide, "reason"> = {
  id: "ibk-startup",
  institution: "IBK기업은행",
  title: "IBK 성공창업대출",
  category: "창업기업 시설·운영자금",
  eligibility: "공식 안내상 창업 후 7년이 지나지 않은 중소기업이 확인할 수 있으며, 초기창업기업 등은 별도 우대 조건이 있어요.",
  confirmation: "업종, 사업성, 상환능력, 담보와 은행 심사를 확인해야 해요. 화면에 과거 금리 예시가 있어 현재 조건은 영업점에서 다시 확인해야 합니다.",
  sourceUrl: "https://mybank.ibk.co.kr/uib/jsp/guest/ntr/ntr70/ntr7015/PNTR701500_i2.jsp?MENU_DIV=GNB&grcd=11&lncd=02&pdcd=0354&tmcd=201",
  checkedAt: CHECKED_AT,
};

const IBK_JOBS: Omit<BankFundingGuide, "reason"> = {
  id: "ibk-jobs",
  institution: "IBK기업은행",
  title: "IBK 일자리PLUS대출",
  category: "창업·고용기업 시설·운영자금",
  eligibility: "공식 안내상 창업 3년 이내 기업 또는 별도 일자리 창출·고용 유지 조건을 충족한 중소기업이 확인할 수 있어요.",
  confirmation: "직원을 둘 계획만으로 대상이 되는 것은 아니며, 창업일·고용인원·신용과 은행 심사를 확인해야 해요.",
  sourceUrl: "https://mybank.ibk.co.kr/uib/jsp/guest/ntr/ntr70/ntr7015/PNTR701500_i2.jsp?grcd=11&lncd=02&pdcd=0451&tmcd=201",
  checkedAt: CHECKED_AT,
};

const KDB_ONLENDING: Omit<BankFundingGuide, "reason"> = {
  id: "kdb-onlending",
  institution: "KDB산업은행",
  title: "KDB 특별온렌딩 · 창업·벤처기업",
  category: "중개금융기관을 통한 정책금융",
  eligibility: "중소기업이 중개금융기관의 심사를 거쳐 시설자금 또는 운영자금을 확인하는 제도예요. 창업·벤처기업은 특별온렌딩 우대 분야 중 하나예요.",
  confirmation: "산업은행에 직접 신청하는 일반 소상공인 대출이 아니에요. 중개금융기관, 기업규모, 신용등급, 제외 업종과 자금 용도를 확인해야 합니다.",
  sourceUrl: "https://www.kdb.co.kr/BZCOWS00N00.act?_mnuId=IHIHCC0100&wcmsPath=/hmp/ch/ef/in/CHEFIN1100.html",
  checkedAt: CHECKED_AT,
};

const ADDITIONAL_GUIDES: Record<AdditionalFundingGuide["id"], AdditionalFundingGuide> = {
  "mss-policy": {
    id: "mss-policy",
    institution: "중소벤처기업부 · 소상공인시장진흥공단",
    title: "2026 소상공인 지원사업·정책자금",
    category: "정부 지원·정책자금",
    summary: "예비창업자와 소상공인이 확인할 지원사업과 정책자금을 한 번에 안내하는 공식 통합공고예요.",
    confirmation: "사업별 모집 시기와 대상이 다르므로 소상공인24·정책자금 사이트의 개별 공고를 다시 확인해야 해요.",
    sourceUrl: "https://www.mss.go.kr/site/smba/ex/bbs/View.do?bcIdx=1064370&cbIdx=86",
    checkedAt: CHECKED_AT,
  },
  "seoul-support": {
    id: "seoul-support",
    institution: "서울특별시 · 서울신용보증재단",
    title: "서울시 소상공인 종합지원",
    category: "서울 지원제도",
    summary: "예비창업자와 창업 초기 소상공인을 위한 교육·창업 컨설팅·보증 안내와 운영 단계별 지원을 모아 둔 공식 경로예요.",
    confirmation: "세부 사업마다 모집 여부와 서울 사업장 요건이 다르며, 보증 지원은 별도 심사를 거쳐야 해요.",
    sourceUrl: "https://news.seoul.go.kr/economy/small-business-supports",
    checkedAt: CHECKED_AT,
  },
  "kinfa-microfinance": {
    id: "kinfa-microfinance",
    institution: "서민금융진흥원",
    title: "미소금융 창업·운영자금",
    category: "조건부 정책금융",
    summary: "제도권 금융 이용이 어려운 예비창업자·자영업자가 창업자금이나 운영자금을 상담할 수 있는 제도예요.",
    confirmation: "개인신용평점 하위 20%, 차상위계층 이하, 근로장려금 대상 등 공식 요건 중 하나와 여신심사를 확인해야 해요.",
    sourceUrl: "https://mmc.kinfa.or.kr/view/pdt/KFA_PDT_04010000",
    checkedAt: CHECKED_AT,
  },
  "kb-policy-loan": {
    id: "kb-policy-loan",
    institution: "KB국민은행",
    title: "KB 소상공인 정책자금대출",
    category: "다른 은행 대출",
    summary: "소상공인 정책자금 확인서와 지역신용보증재단 보증서를 받은 개인사업자가 확인할 수 있는 은행 연계 상품이에요.",
    confirmation: "사업자등록 후 영업 중이어야 하며 정책자금 확인서, 보증 승인과 은행 심사가 모두 필요해요.",
    sourceUrl: "https://obiz.kbstar.com/quics?page=C112610",
    checkedAt: CHECKED_AT,
  },
  "woori-click": {
    id: "woori-click",
    institution: "우리은행",
    title: "우리 Oh!클릭 대출",
    category: "다른 은행 대출",
    summary: "사업기간 12개월 이상인 개인사업자가 비대면으로 확인할 수 있는 신용대출 상품이에요.",
    confirmation: "사업기간, 개인·은행 신용등급, 불건전업종 제외 조건과 실제 금리·한도 심사를 확인해야 해요.",
    sourceUrl: "https://sbiz.wooribank.com/biz/Dream%3Fwithyou%3DCSSUS0035",
    checkedAt: CHECKED_AT,
  },
};

export function selectBankFundingGuides(
  answers: Record<string, string> | null,
  stage?: FundingStage,
): BankFundingGuide[] {
  const operation = answers?.operation;
  const risk = answers?.risk;
  const stagePrefix = stage === "pre_startup" ? "사업자등록 전이므로 지금은 조건만 살펴보고, 등록 후 다시 확인하세요. " : "";

  const ibk = operation === "team"
    ? { ...IBK_JOBS, reason: `${stagePrefix}직원과 팀으로 운영하겠다는 답을 반영해 창업·고용 조건을 먼저 확인할 후보로 두었어요.` }
    : risk === "growth"
      ? { ...IBK_STARTUP, reason: `${stagePrefix}좋은 입지와 공간에 투자할 수 있다는 답을 반영해 시설·운영자금 후보를 먼저 보여드려요.` }
      : { ...IBK_BOX, reason: `${stagePrefix}처음부터 특정 상품을 단정하지 않고, 사업자 조건으로 실제 신청 가능한 기업대출을 확인하는 경로를 먼저 보여드려요.` };

  const kdbReason = risk === "growth"
    ? "공간과 설비 투자를 생각하고 있어 시설·운영자금을 함께 확인할 수 있는 정책금융 제도를 후보로 두었어요."
    : "상권 비용을 확인한 뒤 시설자금과 운영자금을 나눠 상담할 수 있는 정책금융 제도를 비교 후보로 두었어요.";

  return [ibk, { ...KDB_ONLENDING, reason: `${stagePrefix}${kdbReason}` }];
}

export function selectAdditionalFundingGuides(
  stage?: FundingStage,
  yearsInBusiness = 0,
): AdditionalFundingGuide[] {
  const common = [
    ADDITIONAL_GUIDES["mss-policy"],
    ADDITIONAL_GUIDES["seoul-support"],
  ];
  if (stage === "existing" && yearsInBusiness >= 1) {
    return [...common, ADDITIONAL_GUIDES["kb-policy-loan"], ADDITIONAL_GUIDES["woori-click"]];
  }
  return [...common, ADDITIONAL_GUIDES["kinfa-microfinance"], ADDITIONAL_GUIDES["kb-policy-loan"]];
}

export function parseFundingAreaCode(hash: string): string {
  return new URLSearchParams(hash.split("?")[1] || "").get("code") || "";
}
