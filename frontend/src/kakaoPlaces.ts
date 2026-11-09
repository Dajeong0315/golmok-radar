declare global {
  interface Window {
    kakao?: any;
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

export type KakaoPlace = {
  id: string;
  name: string;
  category: string;
  categoryGroupCode: string;
  address: string;
  roadAddress: string;
  latitude: number;
  longitude: number;
  distance: number | null;
  placeUrl: string;
};

let sdkPromise: Promise<void> | null = null;

export function loadKakaoSdk(): Promise<void> {
  if (window.kakao?.maps?.services && window.kakao?.maps?.MarkerClusterer) return Promise.resolve();
  if (!KAKAO_KEY) return Promise.reject(new Error("카카오 JavaScript 키가 설정되지 않았습니다."));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-sdk], script[data-kakao-map]");
    const finish = () => window.kakao.maps.load(() => {
      if (window.kakao?.maps?.services && window.kakao?.maps?.MarkerClusterer) resolve();
      else reject(new Error("카카오 지도 모듈을 불러오지 못했습니다. 화면을 새로고침해 주세요."));
    });
    if (existing) {
      if (window.kakao?.maps) finish();
      else {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", () => reject(new Error("카카오 서비스를 불러오지 못했습니다.")), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.dataset.kakaoSdk = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false&libraries=services,clusterer`;
    script.onload = finish;
    script.onerror = () => reject(new Error("카카오 서비스를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function normalizePlace(item: any): KakaoPlace {
  return {
    id: String(item.id),
    name: item.place_name,
    category: item.category_name,
    categoryGroupCode: item.category_group_code || "",
    address: item.address_name,
    roadAddress: item.road_address_name,
    latitude: Number(item.y),
    longitude: Number(item.x),
    distance: item.distance ? Number(item.distance) : null,
    placeUrl: item.place_url,
  };
}

export async function searchKakaoPlaces(
  query: string,
  options?: { latitude: number; longitude: number; radius: number },
): Promise<KakaoPlace[]> {
  await loadKakaoSdk();
  return new Promise((resolve, reject) => {
    const kakao = window.kakao;
    const searchOptions = options ? {
      location: new kakao.maps.LatLng(options.latitude, options.longitude),
      radius: options.radius,
      sort: kakao.maps.services.SortBy.DISTANCE,
      size: 15,
    } : { size: 10 };
    new kakao.maps.services.Places().keywordSearch(query, (items: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK) resolve(items.map(normalizePlace));
      else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
      else reject(new Error("가게 검색을 완료하지 못했습니다."));
    }, searchOptions);
  });
}

export async function searchNearbyCafes(latitude: number, longitude: number): Promise<KakaoPlace[]> {
  await loadKakaoSdk();
  const kakao = window.kakao;
  const places = new kakao.maps.services.Places();
  const found: KakaoPlace[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await new Promise<KakaoPlace[]>((resolve, reject) => {
      places.categorySearch("CE7", (items: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK) resolve(items.map(normalizePlace));
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error("주변 카페 검색을 완료하지 못했습니다."));
      }, {
        location: new kakao.maps.LatLng(latitude, longitude),
        radius: 1200,
        sort: kakao.maps.services.SortBy.DISTANCE,
        size: 15,
        page,
      });
    });
    found.push(...batch);
    if (batch.length < 15) break;
  }
  return [...new Map(found.map((place) => [place.id, place])).values()];
}

export function matchesIndustryCategory(category: string, terms: string[], excludedTerms: string[] = []): boolean {
  // Kakao often appends a brand as the leaf (for example, 카페 > 커피전문점 > 브랜드명).
  // Validate the full category path so a valid parent classification is not rejected.
  const normalizedCategory = category.replace(/\s+/g, "");
  return Boolean(normalizedCategory)
    && !excludedTerms.some((term) => normalizedCategory.includes(term.replace(/\s+/g, "")))
    && terms.some((term) => normalizedCategory.includes(term.replace(/\s+/g, "")));
}

export async function searchNearbyIndustry(
  latitude: number,
  longitude: number,
  industryCode: string,
  terms: string[],
  excludedTerms: string[] = [],
): Promise<KakaoPlace[]> {
  if (!terms.length) return [];
  if (industryCode === "CS100010") {
    const cafes = await searchNearbyCafes(latitude, longitude);
    return cafes.filter((place) => matchesIndustryCategory(place.category, terms, excludedTerms));
  }
  await loadKakaoSdk();
  const kakao = window.kakao;
  const places = new kakao.maps.services.Places();
  const found: KakaoPlace[] = [];
  for (const term of terms.slice(0, 2)) {
    for (let page = 1; page <= 3; page += 1) {
      const batch = await new Promise<KakaoPlace[]>((resolve, reject) => {
        places.keywordSearch(term, (items: any[], status: string) => {
          if (status === kakao.maps.services.Status.OK) resolve(items.map(normalizePlace));
          else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
          else reject(new Error("주변 동종 가게 검색을 완료하지 못했습니다."));
        }, {
          location: new kakao.maps.LatLng(latitude, longitude), radius: 1200,
          sort: kakao.maps.services.SortBy.DISTANCE, size: 15, page,
        });
      });
      found.push(...batch);
      if (batch.length < 15) break;
    }
    if (found.filter((place) => matchesIndustryCategory(place.category, terms, excludedTerms)).length >= 10) break;
  }
  return [...new Map(found.map((place) => [place.id, place])).values()]
    .filter((place) => matchesIndustryCategory(place.category, terms, excludedTerms));
}

export function selectNearbyPlaces(places: KakaoPlace[], ownPlaceId: string, count: number): KakaoPlace[] {
  return places.filter((place) => place.id !== ownPlaceId).slice(0, Math.max(0, count));
}
