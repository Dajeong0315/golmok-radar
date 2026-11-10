import type { TradeArea } from "./types";

export type AreaFilter = { district: string; query: string; onlyWithStats: boolean };

/** 상권 탐색 목록·지도에 보일 상권. `onlyWithStats`면 선택 업종의 공식 점포 원천 행이 있는 상권만 남깁니다. */
export function filterExplorerAreas(areas: TradeArea[], filter: AreaFilter): TradeArea[] {
  const normalized = filter.query.trim().toLowerCase();
  return areas.filter((area) => {
    const districtMatch = filter.district === "전체" || area.district_name === filter.district;
    const queryMatch = !normalized || `${area.district_name} ${area.name} ${area.area_type_name}`.toLowerCase().includes(normalized);
    return districtMatch && queryMatch && (!filter.onlyWithStats || area.data_status.store);
  });
}

export const STATUS_LABELS = {
  store: "점포",
  sales: "매출",
  population: "유동인구",
} as const;

export function statusBadge(kind: keyof typeof STATUS_LABELS, available: boolean): { text: string; title: string } {
  const label = STATUS_LABELS[kind];
  if (available) return { text: `${label} 통계 있음`, title: `${label} 공식 통계가 있어요.` };
  const scope = kind === "population" ? "이 상권" : "이 상권·업종";
  return {
    text: `${label} 통계 없음`,
    title: `서울시 공식 원천에 ${scope}의 ${label} 행이 없어요. 0개라는 뜻이 아니며, 0이나 다른 값으로 채우지 않아요.`,
  };
}
