export const PROFILE_KEY = "golmok-radar:founder-profile:v1";
export const DRAFT_KEY = "golmok-radar:founder-profile-draft:v1";
export const SKIPPED_KEY = "golmok-radar:founder-profile-skipped:v1";
export const PROFILE_VERSION = 1;

export type FounderAnswer = {
  id: string;
  label: string;
  resultLabel: string;
};

export type FounderQuestion = {
  id: string;
  eyebrow: string;
  question: string;
  helper: string;
  options: FounderAnswer[];
};

export type FounderProfile = {
  version: number;
  completedAt: string;
  answers: Record<string, string>;
};

export const FOUNDER_QUESTIONS: FounderQuestion[] = [
  {
    id: "business",
    eyebrow: "01 · BUSINESS",
    question: "가장 먼저 떠올리는 오프라인 창업은 무엇인가요?",
    helper: "지금 가장 마음이 가는 업종을 골라 주세요. 나중에 바꿀 수 있어요.",
    options: [
      { id: "cafe", label: "카페 · 디저트", resultLabel: "카페·디저트 관심" },
      { id: "food", label: "식당 · 주점", resultLabel: "외식·주점 관심" },
      { id: "retail", label: "소매 · 편집숍", resultLabel: "소매·편집숍 관심" },
      { id: "service", label: "생활서비스 · 스튜디오", resultLabel: "서비스·스튜디오 관심" },
    ],
  },
  {
    id: "demand",
    eyebrow: "02 · CUSTOMERS",
    question: "만들고 싶은 공간의 분위기는 무엇에 가까운가요?",
    helper: "누가 언제 찾아오는 공간이면 좋을지 떠올려 보세요.",
    options: [
      { id: "neighborhood", label: "동네 단골이 꾸준히 오는 곳", resultLabel: "생활권 단골 수요" },
      { id: "office", label: "직장인이 빠르게 이용하는 곳", resultLabel: "업무권 회전 수요" },
      { id: "destination", label: "일부러 찾아오는 개성 있는 곳", resultLabel: "목적 방문 수요" },
      { id: "nightlife", label: "저녁과 밤에 활기가 커지는 곳", resultLabel: "야간 활기 수요" },
    ],
  },
  {
    id: "risk",
    eyebrow: "03 · BUDGET",
    question: "초기 비용과 위험을 어떻게 다루고 싶나요?",
    helper: "정확한 예산을 묻는 단계가 아니라 투자 태도를 정리하는 질문이에요.",
    options: [
      { id: "lean", label: "고정비를 최대한 작게 시작", resultLabel: "보수적 비용 운용" },
      { id: "balanced", label: "안정성과 성장의 균형", resultLabel: "균형적 비용 운용" },
      { id: "growth", label: "가능성이 보이면 먼저 투자", resultLabel: "성장 중심 투자" },
      { id: "unknown", label: "아직 감이 없어 비교가 필요", resultLabel: "예산 탐색 필요" },
    ],
  },
  {
    id: "operation",
    eyebrow: "04 · OPERATION",
    question: "생각하는 운영 방식은 무엇에 가까운가요?",
    helper: "처음 1년 동안 실제로 감당할 수 있는 방식에 가깝게 골라 주세요.",
    options: [
      { id: "solo", label: "혼자 운영하는 작은 가게", resultLabel: "1인 소형 운영" },
      { id: "partner", label: "가족이나 파트너와 함께", resultLabel: "파트너 균형 운영" },
      { id: "team", label: "직원과 표준화해 확장", resultLabel: "팀 기반 확장 운영" },
      { id: "community", label: "관계와 커뮤니티 중심", resultLabel: "커뮤니티 중심 운영" },
    ],
  },
  {
    id: "strength",
    eyebrow: "05 · STRENGTH",
    question: "가장 자신 있는 창업자 강점은 무엇인가요?",
    helper: "완벽한 능력이 아니라 상대적으로 즐기고 오래 할 수 있는 일을 골라 주세요.",
    options: [
      { id: "product", label: "제품 · 메뉴를 만드는 일", resultLabel: "제품·메뉴 강점" },
      { id: "hospitality", label: "고객을 응대하는 일", resultLabel: "고객 응대 강점" },
      { id: "branding", label: "공간과 브랜드를 만드는 일", resultLabel: "공간·브랜딩 강점" },
      { id: "numbers", label: "숫자와 운영을 관리하는 일", resultLabel: "숫자·운영 강점" },
    ],
  },
  {
    id: "competition",
    eyebrow: "06 · COMPETITION",
    question: "경쟁이 많은 상권을 어떻게 보나요?",
    helper: "경쟁을 견디는 방식에 따라 후보 상권의 우선순위가 달라져요.",
    options: [
      { id: "avoid", label: "가능하면 경쟁을 피하고 싶어요", resultLabel: "낮은 경쟁 선호" },
      { id: "validated", label: "수요가 검증됐다면 괜찮아요", resultLabel: "검증 수요 선호" },
      { id: "differentiate", label: "차별화로 경쟁할 수 있어요", resultLabel: "차별화 경쟁 선호" },
      { id: "traffic", label: "유동이 크다면 경쟁을 감수해요", resultLabel: "유동 우선 선호" },
    ],
  },
];

export function sanitizeAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(FOUNDER_QUESTIONS.flatMap((question) => {
    const answer = candidate[question.id];
    return typeof answer === "string" && question.options.some((option) => option.id === answer)
      ? [[question.id, answer]]
      : [];
  }));
}

export function loadDraft(storage: Storage): Record<string, string> {
  try { return sanitizeAnswers(JSON.parse(storage.getItem(DRAFT_KEY) || "{}")); } catch { return {}; }
}

export function loadProfile(storage: Storage): FounderProfile | null {
  try {
    const value = JSON.parse(storage.getItem(PROFILE_KEY) || "null") as Partial<FounderProfile> | null;
    if (!value || value.version !== PROFILE_VERSION) return null;
    const answers = sanitizeAnswers(value.answers);
    if (Object.keys(answers).length !== FOUNDER_QUESTIONS.length) return null;
    return { version: PROFILE_VERSION, completedAt: String(value.completedAt || ""), answers };
  } catch { return null; }
}

export function answerLabel(questionId: string, answerId: string): string {
  return FOUNDER_QUESTIONS.find((question) => question.id === questionId)?.options.find((option) => option.id === answerId)?.resultLabel || "";
}

export function profileTitle(answers: Record<string, string>): string {
  const demand: Record<string, string> = { neighborhood: "동네 단골을 만드는", office: "빠른 일상을 붙잡는", destination: "목적 방문을 이끄는", nightlife: "저녁의 활기를 살리는" };
  const operation: Record<string, string> = { solo: "소형 효율형", partner: "균형 운영형", team: "확장 설계형", community: "관계 중심형" };
  return `${demand[answers.demand] || "방향을 찾는"} ${operation[answers.operation] || "예비 창업자"}`;
}
