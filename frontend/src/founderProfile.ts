export const PROFILE_KEY = "golmok-radar:founder-profile:v2";
export const PROFILE_HISTORY_KEY = "golmok-radar:founder-profile-history:v1";
export const DRAFT_KEY = "golmok-radar:founder-profile-draft:v2";
export const SKIPPED_KEY = "golmok-radar:founder-profile-skipped:v2";
export const PROFILE_VERSION = 2;

export type FounderAnswer = {
  id: string;
  label: string;
  description: string;
  resultLabel: string;
};

export type FounderQuestion = {
  id: string;
  eyebrow: string;
  question: string;
  questionLines: [string, string];
  helper: string;
  why: string;
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
    eyebrow: "01 · 가게 아이디어",
    question: "지금 가장 먼저 열어 보고 싶은 가게는 무엇인가요?",
    questionLines: ["지금 가장 먼저 열어 보고 싶은", "가게는 무엇인가요?"],
    helper: "아직 확정하지 않아도 괜찮아요. 지금 마음이 가장 가는 것을 골라 주세요.",
    why: "업종에 따라 확인해야 할 매출, 손님, 경쟁 가게의 기준이 달라져요.",
    options: [
      { id: "cafe", label: "카페 · 디저트", description: "커피, 베이커리, 디저트 가게", resultLabel: "카페·디저트" },
      { id: "food", label: "식당 · 주점", description: "식사, 포장, 저녁 장사 중심", resultLabel: "식당·주점" },
      { id: "retail", label: "소매 · 편집숍", description: "상품을 골라 판매하는 가게", resultLabel: "소매·편집숍" },
      { id: "service", label: "생활서비스 · 스튜디오", description: "예약과 상담이 중요한 공간", resultLabel: "생활서비스·스튜디오" },
    ],
  },
  {
    id: "demand",
    eyebrow: "02 · 원하는 손님",
    question: "어떤 손님이 자주 찾아오는 가게를 만들고 싶나요?",
    questionLines: ["어떤 손님이 자주 찾아오는", "가게를 만들고 싶나요?"],
    helper: "예쁜 분위기보다 실제로 누가 언제 방문할지를 떠올려 보세요.",
    why: "주요 손님에 따라 평일·주말, 낮·밤에 볼 숫자의 중요도가 달라져요.",
    options: [
      { id: "neighborhood", label: "근처에 사는 동네 단골", description: "반복 방문과 생활권 수요가 중요해요", resultLabel: "동네 단골 중심" },
      { id: "office", label: "출근하거나 일하는 직장인", description: "평일과 점심 시간 수요가 중요해요", resultLabel: "직장인 중심" },
      { id: "destination", label: "일부러 찾아오는 방문객", description: "주말과 가게의 개성이 중요해요", resultLabel: "목적 방문 중심" },
      { id: "nightlife", label: "저녁 약속을 잡는 손님", description: "퇴근 뒤와 밤 시간 수요가 중요해요", resultLabel: "저녁 손님 중심" },
    ],
  },
  {
    id: "risk",
    eyebrow: "03 · 시작 비용",
    question: "첫 가게의 비용은 어떤 방식으로 정하고 싶나요?",
    questionLines: ["첫 가게의 비용은", "어떤 방식으로 정하고 싶나요?"],
    helper: "정확한 금액을 몰라도 괜찮아요. 가장 편안한 시작 방식을 골라 주세요.",
    why: "임대료와 고정비를 어느 정도까지 감당할지 후보를 거르는 기준이 돼요.",
    options: [
      { id: "lean", label: "작게 시작해 부담을 낮추기", description: "보증금·월세·인건비를 먼저 줄여요", resultLabel: "작은 비용으로 시작" },
      { id: "balanced", label: "비용과 성장 가능성 맞추기", description: "무리하지 않는 선에서 기회를 봐요", resultLabel: "비용과 성장의 균형" },
      { id: "growth", label: "좋은 기회라면 먼저 투자하기", description: "입지와 공간에 더 쓸 수 있어요", resultLabel: "성장 기회에 투자" },
      { id: "unknown", label: "아직 몰라서 숫자부터 보기", description: "후보별 비용을 본 뒤 정하고 싶어요", resultLabel: "예산 기준을 찾는 중" },
    ],
  },
  {
    id: "operation",
    eyebrow: "04 · 운영 방식",
    question: "문을 연 뒤에는 누가 가게를 운영할 계획인가요?",
    questionLines: ["문을 연 뒤에는", "누가 가게를 운영할 계획인가요?"],
    helper: "첫 1년 동안 실제로 가능한 모습에 가깝게 골라 주세요.",
    why: "운영 인원에 따라 필요한 매출과 감당할 수 있는 가게 크기가 달라져요.",
    options: [
      { id: "solo", label: "내가 주로 혼자 운영하기", description: "작은 공간과 단순한 메뉴가 편해요", resultLabel: "1인 운영" },
      { id: "partner", label: "가족이나 동업자와 함께하기", description: "역할을 나눠 직접 운영해요", resultLabel: "파트너 운영" },
      { id: "team", label: "직원을 두고 운영하기", description: "업무 기준과 인건비 관리가 중요해요", resultLabel: "직원과 팀 운영" },
      { id: "community", label: "모임과 관계를 중심으로 운영하기", description: "행사와 단골 커뮤니티를 만들고 싶어요", resultLabel: "커뮤니티 운영" },
    ],
  },
  {
    id: "strength",
    eyebrow: "05 · 내가 잘하는 일",
    question: "가게를 준비하면서 가장 즐겁게 할 수 있는 일은 무엇인가요?",
    questionLines: ["가게를 준비하면서", "가장 즐겁게 할 수 있는 일은 무엇인가요?"],
    helper: "이미 잘하는 일이 없어도 괜찮아요. 가장 배우고 싶은 일을 골라도 됩니다.",
    why: "내가 직접 맡을 일과 도움을 받아야 할 일을 나누는 데 쓰여요.",
    options: [
      { id: "product", label: "메뉴나 상품 만들기", description: "맛과 품질을 계속 다듬는 일", resultLabel: "메뉴·상품 만들기" },
      { id: "hospitality", label: "손님을 맞고 이야기하기", description: "응대와 단골 관계를 만드는 일", resultLabel: "손님 응대" },
      { id: "branding", label: "공간과 브랜드 꾸미기", description: "가게 분위기와 홍보를 만드는 일", resultLabel: "공간·브랜드 만들기" },
      { id: "numbers", label: "매출과 비용 관리하기", description: "숫자를 기록하고 운영을 고치는 일", resultLabel: "매출·비용 관리" },
    ],
  },
  {
    id: "competition",
    eyebrow: "06 · 비슷한 가게",
    question: "근처에 비슷한 가게가 많다면 어떻게 느낄 것 같나요?",
    questionLines: ["근처에 비슷한 가게가 많다면", "어떻게 느낄 것 같나요?"],
    helper: "정답은 없어요. 경쟁을 피할지, 손님이 많은 곳을 택할지 생각해 보세요.",
    why: "카페 수가 적은 곳과 이미 수요가 확인된 곳 중 어느 쪽을 먼저 볼지 정해요.",
    options: [
      { id: "avoid", label: "비슷한 가게가 적은 곳부터 보기", description: "경쟁 부담이 작은 후보가 편해요", resultLabel: "경쟁이 적은 곳 선호" },
      { id: "validated", label: "손님이 확인된 곳이라면 괜찮기", description: "수요와 경쟁을 함께 확인할게요", resultLabel: "확인된 수요 선호" },
      { id: "differentiate", label: "다른 메뉴와 분위기로 경쟁하기", description: "내 가게의 차이를 만들 수 있어요", resultLabel: "차별화 경쟁 선호" },
      { id: "traffic", label: "사람이 많다면 경쟁 감수하기", description: "유동인구와 매출 기회를 먼저 봐요", resultLabel: "사람이 많은 곳 선호" },
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

export function loadDraft(storage: Storage, userId?: string | null): Record<string, string> {
  if (!mayReadLocalData(storage, userId)) return {};
  try { return sanitizeAnswers(JSON.parse(storage.getItem(DRAFT_KEY) || "{}")); } catch { return {}; }
}

export function loadProfile(storage: Storage, userId?: string | null): FounderProfile | null {
  if (!mayReadLocalData(storage, userId)) return null;
  const history = loadProfiles(storage, userId);
  if (history.length) return history[0];
  try {
    const value = JSON.parse(storage.getItem(PROFILE_KEY) || "null") as Partial<FounderProfile> | null;
    if (!value || value.version !== PROFILE_VERSION) return null;
    const answers = sanitizeAnswers(value.answers);
    if (Object.keys(answers).length !== FOUNDER_QUESTIONS.length) return null;
    return { version: PROFILE_VERSION, completedAt: String(value.completedAt || ""), answers };
  } catch { return null; }
}

export function loadProfiles(storage: Storage, userId?: string | null): FounderProfile[] {
  if (!mayReadLocalData(storage, userId)) return [];
  try {
    const saved = JSON.parse(storage.getItem(PROFILE_HISTORY_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.flatMap((value) => {
      if (!value || value.version !== PROFILE_VERSION) return [];
      const answers = sanitizeAnswers(value.answers);
      return Object.keys(answers).length === FOUNDER_QUESTIONS.length ? [{ version: PROFILE_VERSION, completedAt: String(value.completedAt || ""), answers }] : [];
    }).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  } catch { return []; }
}

export function saveProfile(storage: Storage, profile: FounderProfile): void {
  const history = loadProfiles(storage);
  const existing = history.length ? [] : [loadProfile(storage)].filter((item): item is FounderProfile => item !== null);
  storage.setItem(PROFILE_HISTORY_KEY, JSON.stringify([profile, ...history, ...existing]));
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function answerLabel(questionId: string, answerId: string): string {
  return FOUNDER_QUESTIONS.find((question) => question.id === questionId)?.options.find((option) => option.id === answerId)?.resultLabel || "";
}

export function answerDescription(questionId: string, answerId: string): string {
  return FOUNDER_QUESTIONS.find((question) => question.id === questionId)?.options.find((option) => option.id === answerId)?.description || "";
}

export function profileTitle(answers: Record<string, string>): string {
  const demand: Record<string, string> = { neighborhood: "동네 단골을 차근차근 만드는", office: "직장인의 일상에 들어가는", destination: "찾아올 이유를 만드는", nightlife: "저녁 손님을 맞이하는" };
  const operation: Record<string, string> = { solo: "1인 운영형", partner: "함께 운영형", team: "팀 운영형", community: "관계 중심형" };
  return `${demand[answers.demand] || "방향을 찾아가는"} ${operation[answers.operation] || "예비 사장님"}`;
}

export function profileTitleLines(answers: Record<string, string>): [string, string] {
  const demand: Record<string, [string, string]> = {
    neighborhood: ["동네 단골을 차근차근", "만드는"],
    office: ["직장인의 일상에", "들어가는"],
    destination: ["찾아올 이유를", "만드는"],
    nightlife: ["저녁 손님을", "맞이하는"],
  };
  const operation: Record<string, string> = { solo: "1인 운영형", partner: "함께 운영형", team: "팀 운영형", community: "관계 중심형" };
  const [firstLine, secondLine] = demand[answers.demand] || ["방향을", "찾아가는"];
  return [firstLine, `${secondLine} ${operation[answers.operation] || "예비 사장님"}`];
}
import { mayReadLocalData } from "./favorites";

