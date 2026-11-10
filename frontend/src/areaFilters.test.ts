import { describe, expect, it } from "vitest";

import { filterExplorerAreas, statusBadge } from "./areaFilters";
import type { TradeArea } from "./types";

const area = (code: string, name: string, district: string, store: boolean): TradeArea => ({
  code, name, district_name: district, area_type_name: "골목상권", latitude: 37.5, longitude: 127,
  data_status: { store, sales: store, population: true },
});
const AREAS = [area("1", "성수역", "성동구", true), area("2", "강남구보훈회관", "강남구", false), area("3", "가로수길", "강남구", true)];

describe("explorer area filter", () => {
  it("keeps only areas with official store rows when requested", () => {
    expect(filterExplorerAreas(AREAS, { district: "전체", query: "", onlyWithStats: true }).map((item) => item.code)).toEqual(["1", "3"]);
    expect(filterExplorerAreas(AREAS, { district: "전체", query: "", onlyWithStats: false })).toHaveLength(3);
  });

  it("combines the stats filter with district and search", () => {
    expect(filterExplorerAreas(AREAS, { district: "강남구", query: "", onlyWithStats: true }).map((item) => item.code)).toEqual(["3"]);
    expect(filterExplorerAreas(AREAS, { district: "전체", query: "보훈", onlyWithStats: true })).toEqual([]);
    expect(filterExplorerAreas(AREAS, { district: "전체", query: "보훈", onlyWithStats: false }).map((item) => item.code)).toEqual(["2"]);
  });
});

describe("status badges", () => {
  it("says what is missing without implying zero", () => {
    expect(statusBadge("store", true).text).toBe("점포 통계 있음");
    const missing = statusBadge("store", false);
    expect(missing.text).toBe("점포 통계 없음");
    expect(missing.title).toContain("이 상권·업종");
    expect(missing.title).toContain("0개라는 뜻이 아니며");
    expect(statusBadge("population", false)).toMatchObject({ text: "유동인구 통계 없음" });
    expect(statusBadge("population", false).title).toContain("이 상권의 유동인구 행");
  });
});
