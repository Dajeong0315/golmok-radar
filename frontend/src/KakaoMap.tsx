import { useEffect, useRef, useState } from "react";

import { loadKakaoSdk } from "./kakaoPlaces";
import type { TradeArea } from "./types";

type Props = {
  areas: TradeArea[];
  favorites: Set<string>;
  onSelectArea: (code: string) => void;
  selectedCode?: string;
  showDistrictGuide?: boolean;
};

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

type MapLayer = {
  setMap: (map: null) => void;
};

export function detachMapLayers(layers: MapLayer[]) {
  layers.forEach((layer) => layer.setMap(null));
}

export function KakaoMap({ areas, favorites, onSelectArea, selectedCode, showDistrictGuide = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!KAKAO_KEY || !container.current) return;
    let disposed = false;
    const mapContainer = container.current;
    const markers: MapLayer[] = [];
    const overlays: MapLayer[] = [];
    let clusterer: { clear: () => void; setMap: (map: null) => void } | undefined;
    loadKakaoSdk()
      .then(() => {
        if (disposed || !container.current) return;
        const kakao = window.kakao;
        const map = new kakao.maps.Map(container.current, {
          center: new kakao.maps.LatLng(37.5665, 126.978),
          level: 8,
        });
        const bounds = new kakao.maps.LatLngBounds();
        const markerClusterer = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 5,
          gridSize: 80,
          minClusterSize: 2,
          styles: [{
            width: '48px', height: '48px', lineHeight: '48px',
            borderRadius: '50%', background: '#1769d2', color: '#fff',
            textAlign: 'center', fontWeight: '700', fontSize: '14px',
            border: '3px solid #fff', boxShadow: '0 2px 8px #0003',
          }],
        });
        clusterer = markerClusterer;
        areas.forEach((area) => {
          const position = new kakao.maps.LatLng(area.latitude, area.longitude);
          bounds.extend(position);
          const marker = new kakao.maps.Marker({ position, title: area.name });
          markers.push(marker);
          if (selectedCode === area.code) {
            const content = document.createElement("button");
            content.className = `map-label ${favorites.has(area.code) ? "is-favorite" : ""} ${selectedCode === area.code ? "is-selected" : ""}`;
            content.textContent = `${favorites.has(area.code) ? "★ " : ""}${area.name}`;
            content.onclick = () => onSelectArea(area.code);
            const overlay = new kakao.maps.CustomOverlay({ map, position, content, yAnchor: 2.2 });
            overlays.push(overlay);
          }
          kakao.maps.event.addListener(marker, "click", () => onSelectArea(area.code));
        });
        markerClusterer.addMarkers(markers);
        if (areas.length === 1) {
          map.setCenter(new kakao.maps.LatLng(areas[0].latitude, areas[0].longitude));
          map.setLevel(4);
        } else if (areas.length) {
          map.setBounds(bounds);
        }
      })
      .catch((reason: Error) => setError(reason.message));
    return () => {
      disposed = true;
      clusterer?.clear();
      clusterer?.setMap(null);
      detachMapLayers(markers);
      detachMapLayers(overlays);
      mapContainer.replaceChildren();
    };
  }, [areas, favorites, onSelectArea, selectedCode]);

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
  return <div className="map-wrap"><div className="map-canvas" ref={container} aria-label="서울 공식 상권 지도" />{showDistrictGuide ? <p className="map-guide">숫자는 묶인 상권 수예요. 숫자를 누르거나 지도를 확대하면 개별 핀이 보여요.</p> : null}</div>;
}

