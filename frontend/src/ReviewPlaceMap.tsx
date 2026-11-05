import { useEffect, useRef, useState } from "react";

import { loadKakaoSdk, type KakaoPlace } from "./kakaoPlaces";

export function validSeoulPlace(place: KakaoPlace): boolean {
  return Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    && place.latitude >= 37.4 && place.latitude <= 37.75
    && place.longitude >= 126.7 && place.longitude <= 127.3;
}

export function ReviewPlaceMap({ place, onConfirm, categoryAllowed = true }: { place: KakaoPlace; onConfirm: () => void; categoryAllowed?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const valid = validSeoulPlace(place);

  useEffect(() => {
    setError("");
    setReady(false);
    if (!valid || !container.current) return;
    let active = true;
    loadKakaoSdk().then(() => {
      if (!active || !container.current) return;
      const point = new window.kakao.maps.LatLng(place.latitude, place.longitude);
      const map = new window.kakao.maps.Map(container.current, { center: point, level: 3 });
      new window.kakao.maps.Marker({ map, position: point, title: place.name });
      window.kakao.maps.event.trigger(map, "resize");
      map.setCenter(point);
      setReady(true);
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [place.id, place.latitude, place.longitude, valid]);

  return <section className="review-place-preview" aria-label="선택한 가게의 위치 확인">
    <div><small>선택한 장소의 지도 위치</small><h3>{place.name}</h3><p>{place.roadAddress || place.address || "주소 정보 없음"}</p><p>{place.category || "카카오 분류 정보 없음"}</p></div>
    {valid ? <div className="review-place-map" ref={container} role="img" aria-label={`${place.name} 위치 지도`} /> : <p className="review-auto-note">좌표가 없거나 서울 범위 밖입니다. 다른 검색 결과를 선택해 주세요.</p>}
    {error ? <p className="review-auto-note" role="alert">지도 연결 실패: {error}</p> : null}
    {!categoryAllowed ? <p className="review-auto-note">선택한 장소의 카카오 분류가 선택 업종과 다릅니다. 다른 장소나 업종을 선택해 주세요.</p> : null}
    <button type="button" disabled={!valid || !ready || !categoryAllowed || Boolean(error)} onClick={onConfirm}>{ready ? "이 위치가 맞아요 · 상권 확인" : "지도 위치 확인 중"}</button>
  </section>;
}
