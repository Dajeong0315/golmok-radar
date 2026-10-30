import { useEffect, useRef, useState } from "react";

import type { TradeArea } from "./types";


declare global {
  interface Window {
    kakao?: any;
  }
}

type Props = {
  areas: TradeArea[];
  favorites: Set<string>;
  onToggleFavorite: (code: string) => void;
  showDistrictGuide?: boolean;
};

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

type MapLayer = {
  setMap: (map: null) => void;
};

export function detachMapLayers(layers: MapLayer[]) {
  layers.forEach((layer) => layer.setMap(null));
}

function loadKakaoMap(): Promise<void> {
  if (window.kakao?.maps) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>("script[data-kakao-map]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => window.kakao.maps.load(resolve), { once: true });
      existing.addEventListener("error", () => reject(new Error("카카오맵을 불러오지 못했습니다.")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.kakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = () => reject(new Error("카카오맵을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

export function KakaoMap({ areas, favorites, onToggleFavorite, showDistrictGuide = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!KAKAO_KEY || !container.current) return;
    let disposed = false;
    const mapContainer = container.current;
    const markers: MapLayer[] = [];
    const overlays: MapLayer[] = [];
    loadKakaoMap()
      .then(() => {
        if (disposed || !container.current) return;
        const kakao = window.kakao;
        const map = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(37.5665, 126.978),
          level: 8,
        });
        const bounds = new kakao.maps.LatLngBounds();
        areas.forEach((area) => {
          const position = new kakao.maps.LatLng(area.latitude, area.longitude);
          bounds.extend(position);
          const marker = new kakao.maps.Marker({ map, position, title: area.name });
          markers.push(marker);
          const content = document.createElement("button");
          content.className = `map-label ${favorites.has(area.code) ? "is-favorite" : ""}`;
          content.textContent = `${favorites.has(area.code) ? "★" : "☆"} ${area.name}`;
          content.onclick = () => onToggleFavorite(area.code);
          const overlay = new kakao.maps.CustomOverlay({ map, position, content, yAnchor: 2.2 });
          overlays.push(overlay);
          kakao.maps.event.addListener(marker, "click", () => overlay.setMap(map));
        });
        if (areas.length) map.setBounds(bounds);
      })
      .catch((reason: Error) => setError(reason.message));
    return () => {
      disposed = true;
      detachMapLayers(markers);
      detachMapLayers(overlays);
      mapContainer.replaceChildren();
    };
  }, [areas, favorites, onToggleFavorite]);

  if (!KAKAO_KEY) {
    return (
      <div className="map-fallback" role="status">
        <span className="map-fallback__icon">⌖</span>
        <strong>지도 연결 준비 중</strong>
        <p><code>VITE_KAKAO_MAP_KEY</code>를 설정하면 상권 위치가 여기에 표시됩니다.</p>
      </div>
    );
  }
  if (error) return <div className="map-fallback map-fallback--error">{error}</div>;
  return <div className="map-wrap"><div className="map-canvas" ref={container} aria-label="서울 공식 상권 지도" />{showDistrictGuide ? <p className="map-guide">자치구를 고르면 공식 상권의 위치와 이름이 지도에 표시돼요.</p> : null}</div>;
}

