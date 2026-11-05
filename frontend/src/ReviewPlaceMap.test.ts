import { describe, expect, it } from "vitest";

import { validSeoulPlace } from "./ReviewPlaceMap";
import type { KakaoPlace } from "./kakaoPlaces";

const place: KakaoPlace = {
  id: "123", name: "테스트 가게", category: "음식점", address: "서울 성동구",
  roadAddress: "", latitude: 37.54, longitude: 127.05, distance: null, placeUrl: "",
};

describe("selected place map validation", () => {
  it("accepts finite Seoul coordinates", () => {
    expect(validSeoulPlace(place)).toBe(true);
  });

  it("rejects missing and out-of-range coordinates", () => {
    expect(validSeoulPlace({ ...place, latitude: Number.NaN })).toBe(false);
    expect(validSeoulPlace({ ...place, longitude: 129.1 })).toBe(false);
  });
});
