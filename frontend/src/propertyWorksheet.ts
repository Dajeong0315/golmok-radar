export const PROPERTY_WORKSHEETS_KEY = "golmok-radar:property-worksheets:v1";

export type AreaUnit = "sqm" | "pyeong";
export type VatStatus = "included" | "separate" | "needs_confirmation";
export type CheckStatus = "confirmed" | "needs_follow_up" | "not_applicable" | "not_recorded";

export type PropertyWorksheet = {
  id: string;
  alias: string;
  locationDescription: string;
  floor: string;
  exclusiveArea: number | null;
  areaUnit: AreaUnit;
  depositWon: number | null;
  monthlyRentWon: number | null;
  maintenanceFeeWon: number | null;
  vatStatus: VatStatus;
  premiumWon: number | null;
  brokerageFeeWon: number | null;
  initialCostWon: number | null;
  expectedMonthlySalesWon: number | null;
  checks: Record<string, CheckStatus>;
  observations: Observation[];
  updatedAt: string;
};

export type Observation = {
  id: string;
  date: string;
  dayType: "weekday" | "weekend";
  timeBand: "morning" | "lunch" | "evening";
};

export type CalculatedValue = {
  status: "available" | "input_required" | "unavailable";
  value: number | null;
  reason: string | null;
};

export type WorksheetCalculation = {
  initialInvestment: CalculatedValue;
  monthlySpaceCost: CalculatedValue;
  monthlyCostPerSqm: CalculatedValue;
  spaceCostToSalesRatio: CalculatedValue;
};

export const CHECK_ITEMS = [
  { key: "foot_traffic", category: "현장", label: "보행 흐름과 선택 업종의 실제 이용 가능성" },
  { key: "competition", category: "현장", label: "인접 경쟁점, 좌석, 대기, 공실" },
  { key: "visibility", category: "현장", label: "전면 폭, 가시성, 출입 동선" },
  { key: "facilities", category: "시설", label: "전기, 급배수, 배기, 화장실, 주차·상하차" },
  { key: "environment", category: "환경", label: "소음, 악취, 공사 제약" },
  { key: "building_use", category: "계약 전 확인", label: "건축물 용도" },
  { key: "business_permission", category: "계약 전 확인", label: "영업 가능 여부" },
  { key: "lease_terms", category: "계약 전 확인", label: "임대차 특약" },
  { key: "restoration", category: "계약 전 확인", label: "원상복구" },
] as const;

const statuses = new Set<CheckStatus>(["confirmed", "needs_follow_up", "not_applicable", "not_recorded"]);
const defaultChecks = (): Record<string, CheckStatus> => Object.fromEntries(CHECK_ITEMS.map((item) => [item.key, "not_recorded"]));

function isoNow(): string {
  return new Date().toISOString();
}

export function createWorksheet(id: string = crypto.randomUUID()): PropertyWorksheet {
  return {
    id,
    alias: "",
    locationDescription: "",
    floor: "",
    exclusiveArea: null,
    areaUnit: "sqm",
    depositWon: null,
    monthlyRentWon: null,
    maintenanceFeeWon: null,
    vatStatus: "needs_confirmation",
    premiumWon: null,
    brokerageFeeWon: null,
    initialCostWon: null,
    expectedMonthlySalesWon: null,
    checks: defaultChecks(),
    observations: [],
    updatedAt: isoNow(),
  };
}

function validMoney(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function validOptionalMoney(value: unknown): number | null {
  return value === null ? null : validMoney(value);
}

function validArea(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function validText(value: unknown): string {
  return typeof value === "string" ? value.slice(0, 200) : "";
}

function parseObservations(value: unknown): Observation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const dayType = record.dayType === "weekday" || record.dayType === "weekend" ? record.dayType : null;
    const timeBand = record.timeBand === "morning" || record.timeBand === "lunch" || record.timeBand === "evening" ? record.timeBand : null;
    if (typeof record.id !== "string" || !dayType || !timeBand) return [];
    return [{ id: record.id, date: typeof record.date === "string" ? record.date : "", dayType, timeBand }];
  });
}

export function parsePropertyWorksheet(value: unknown): PropertyWorksheet | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const rawChecks = record.checks && typeof record.checks === "object" ? record.checks as Record<string, unknown> : {};
  const checks = defaultChecks();
  CHECK_ITEMS.forEach((item) => {
    if (statuses.has(rawChecks[item.key] as CheckStatus)) checks[item.key] = rawChecks[item.key] as CheckStatus;
  });
  return {
    id: record.id,
    alias: validText(record.alias),
    locationDescription: validText(record.locationDescription),
    floor: validText(record.floor),
    exclusiveArea: validArea(record.exclusiveArea),
    areaUnit: record.areaUnit === "pyeong" ? "pyeong" : "sqm",
    depositWon: validOptionalMoney(record.depositWon),
    monthlyRentWon: validOptionalMoney(record.monthlyRentWon),
    maintenanceFeeWon: validOptionalMoney(record.maintenanceFeeWon),
    vatStatus: record.vatStatus === "included" || record.vatStatus === "separate" ? record.vatStatus : "needs_confirmation",
    premiumWon: validOptionalMoney(record.premiumWon),
    brokerageFeeWon: validOptionalMoney(record.brokerageFeeWon),
    initialCostWon: validOptionalMoney(record.initialCostWon),
    expectedMonthlySalesWon: validOptionalMoney(record.expectedMonthlySalesWon),
    checks,
    observations: parseObservations(record.observations),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : isoNow(),
  };
}

export function loadPropertyWorksheets(storage: Pick<Storage, "getItem">, userId?: string | null): PropertyWorksheet[] {
  if (!mayReadLocalData(storage, userId)) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PROPERTY_WORKSHEETS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(parsePropertyWorksheet).filter((item): item is PropertyWorksheet => item !== null) : [];
  } catch {
    return [];
  }
}

export function savePropertyWorksheets(storage: Pick<Storage, "setItem">, worksheets: PropertyWorksheet[]): void {
  storage.setItem(PROPERTY_WORKSHEETS_KEY, JSON.stringify(worksheets.map(parsePropertyWorksheet).filter((item): item is PropertyWorksheet => item !== null)));
}

function summedValue(values: Array<number | null>, missingReason: string): CalculatedValue {
  return values.some((value) => value === null)
    ? { status: "input_required", value: null, reason: missingReason }
    : { status: "available", value: values.reduce<number>((total, value) => total + (value ?? 0), 0), reason: null };
}

export function calculatePropertyWorksheet(worksheet: PropertyWorksheet): WorksheetCalculation {
  const initialInvestment = summedValue(
    [worksheet.depositWon, worksheet.premiumWon, worksheet.brokerageFeeWon, worksheet.initialCostWon],
    "보증금, 권리금, 중개수수료, 초기 비용을 모두 입력해 주세요.",
  );
  const monthlySpaceCost = summedValue(
    [worksheet.monthlyRentWon, worksheet.maintenanceFeeWon],
    "월세와 관리비를 모두 입력해 주세요. 관리비가 없거나 확인되지 않았으면 0으로 입력하지 마세요.",
  );
  const areaSqm = worksheet.exclusiveArea === null ? null : worksheet.areaUnit === "pyeong" ? worksheet.exclusiveArea * 3.305785 : worksheet.exclusiveArea;
  const monthlyCostPerSqm = monthlySpaceCost.status !== "available"
    ? { status: "input_required" as const, value: null, reason: monthlySpaceCost.reason }
    : areaSqm === null
      ? { status: "input_required" as const, value: null, reason: "전용면적과 단위를 입력해 주세요." }
      : { status: "available" as const, value: Math.round(monthlySpaceCost.value! / areaSqm), reason: null };
  const spaceCostToSalesRatio = monthlySpaceCost.status !== "available"
    ? { status: "input_required" as const, value: null, reason: monthlySpaceCost.reason }
    : worksheet.expectedMonthlySalesWon === null
      ? { status: "input_required" as const, value: null, reason: "예상 월매출은 선택 입력입니다. 입력하면 비율을 볼 수 있습니다." }
      : worksheet.expectedMonthlySalesWon === 0
        ? { status: "unavailable" as const, value: null, reason: "예상 월매출이 0원이어서 비율을 계산할 수 없습니다." }
        : { status: "available" as const, value: Math.round((monthlySpaceCost.value! / worksheet.expectedMonthlySalesWon) * 1000) / 10, reason: null };
  return { initialInvestment, monthlySpaceCost, monthlyCostPerSqm, spaceCostToSalesRatio };
}
import { mayReadLocalData } from "./favorites";

