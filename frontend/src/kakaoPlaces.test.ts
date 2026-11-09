import { describe, expect, it } from "vitest";

import { matchesIndustryCategory, selectNearbyPlaces, type KakaoPlace } from "./kakaoPlaces";

const place = (id: string): KakaoPlace => ({
  id,
  name: `가게 ${id}`,
  category: "음식점 > 카페",
  categoryGroupCode: "CE7",
  address: "서울",
  roadAddress: "서울",
  latitude: 37.5,
  longitude: 127,
  distance: Number(id) * 10,
  placeUrl: "https://place.map.kakao.com/",
});

describe("nearby place selection", () => {
  it("excludes the selected shop and keeps the requested nearest count", () => {
    expect(selectNearbyPlaces([place("1"), place("2"), place("3"), place("4")], "1", 2).map((item) => item.id)).toEqual(["2", "3"]);
  });

  it("matches the selected industry category path and excludes lookalike subcategories", () => {
    expect(matchesIndustryCategory("교육 > 컴퓨터학원", ["컴퓨터학원"])).toBe(true);
    expect(matchesIndustryCategory("음식점 > 카페 > 커피전문점 > 브랜드명", ["카페", "커피전문점"])).toBe(true);
    expect(matchesIndustryCategory("병원 > 치과의원", ["의원"], ["치과", "한의원"])).toBe(false);
    expect(matchesIndustryCategory("음식점 > 카페", ["한식"])).toBe(false);
  });
});
