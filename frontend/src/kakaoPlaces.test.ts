import { describe, expect, it } from "vitest";

import { selectNearbyPlaces, type KakaoPlace } from "./kakaoPlaces";

const place = (id: string): KakaoPlace => ({
  id,
  name: `가게 ${id}`,
  category: "음식점 > 카페",
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
});
