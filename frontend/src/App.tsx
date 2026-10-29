import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchTradeAreas } from "./api";
import { FAVORITES_KEY, loadFavorites, sanitizeFavorites, toggleComparison, toggleFavorite } from "./favorites";
import { KakaoMap } from "./KakaoMap";
import type { TradeArea } from "./types";
import "./styles.css";


const DISTRICTS = ["전체", "성동구", "광진구"];

export default function App() {
  const [areas, setAreas] = useState<TradeArea[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites(localStorage));
  const [selected, setSelected] = useState<string[]>([]);
  const [district, setDistrict] = useState("전체");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchTradeAreas(controller.signal)
      .then((data) => {
        setAreas(data);
        const cleaned = sanitizeFavorites(favorites, new Set(data.map((area) => area.code)));
        if (cleaned.length !== favorites.length) setFavorites(cleaned);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    setSelected((current) => current.filter((code) => favorites.includes(code)));
  }, [favorites]);

  const areaByCode = useMemo(() => new Map(areas.map((area) => [area.code, area])), [areas]);
  const filteredAreas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return areas.filter((area) => {
      const districtMatch = district === "전체" || area.district_name === district;
      const queryMatch = !normalized || `${area.name} ${area.area_type_name}`.toLowerCase().includes(normalized);
      return districtMatch && queryMatch;
    });
  }, [areas, district, query]);

  const handleFavorite = useCallback((code: string) => {
    setFavorites((current) => toggleFavorite(current, code));
  }, []);

  const handleCompare = (code: string) => {
    const next = toggleComparison(selected, code);
    setSelected(next.codes);
    setNotice(next.limitReached ? "한 번에 최대 네 곳까지 비교할 수 있습니다." : "");
  };

  const goToCompare = () => {
    if (selected.length < 2) return;
    window.location.hash = `compare?codes=${selected.join(",")}`;
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="골목 레이더 홈">
          <span className="brand-mark">G</span>
          <span>골목 레이더</span>
        </a>
        <div className="header-context">
          <a href="#quiz">창업 성향 진단</a>
          <a href="#reviews">개업 후 리뷰 분석</a>
          <span>서울 · 카페</span>
          <strong>2025년 4분기</strong>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">창업 후보지 비교 도구</p>
          <h1>감이 아니라,<br /><em>같은 기준</em>으로 봅니다.</h1>
          <p className="hero-copy">성동구와 광진구 상권을 모아 두고 최대 네 곳의 점포·매출·유동인구를 한눈에 비교하세요.</p>
          <div className="hero-proof">
            <span><b>{areas.length || 117}</b> 공식 상권</span>
            <span><b>14</b> 비교 지표</span>
            <span><b>100%</b> 근거 확인</span>
          </div>
        </section>

        <section className="explorer" aria-labelledby="explorer-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">STEP 1</p>
              <h2 id="explorer-title">관심 상권을 모아보세요</h2>
            </div>
            <p>별표를 누르면 이 브라우저에 저장됩니다.</p>
          </div>

          <div className="filters">
            <div className="district-tabs" aria-label="자치구 필터">
              {DISTRICTS.map((item) => (
                <button className={district === item ? "active" : ""} key={item} onClick={() => setDistrict(item)}>{item}</button>
              ))}
            </div>
            <label className="search-field">
              <span className="sr-only">상권 이름 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상권 이름을 검색하세요" />
              <span>⌕</span>
            </label>
          </div>

          {error ? <div className="error-banner">{error} 백엔드 서버가 실행 중인지 확인해 주세요.</div> : null}
          <div className="explorer-grid">
            <KakaoMap areas={filteredAreas} favorites={new Set(favorites)} onToggleFavorite={handleFavorite} />
            <div className="area-panel">
              <div className="area-panel__header"><strong>상권 목록</strong><span>{filteredAreas.length}곳</span></div>
              {loading ? <p className="panel-state">상권 데이터를 불러오는 중입니다.</p> : null}
              {!loading && !filteredAreas.length ? <p className="panel-state">조건에 맞는 상권이 없습니다.</p> : null}
              <div className="area-list">
                {filteredAreas.map((area) => (
                  <article className="area-card" key={area.code}>
                    <button className={`favorite-button ${favorites.includes(area.code) ? "active" : ""}`} onClick={() => handleFavorite(area.code)} aria-label={`${area.name} 관심 상권 ${favorites.includes(area.code) ? "해제" : "추가"}`}>{favorites.includes(area.code) ? "★" : "☆"}</button>
                    <div>
                      <span className="area-meta">{area.district_name} · {area.area_type_name}</span>
                      <h3>{area.name}</h3>
                      <div className="data-badges">
                        <span className={area.data_status.sales ? "ok" : "missing"}>매출 {area.data_status.sales ? "있음" : "없음"}</span>
                        <span className="ok">인구 있음</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="favorites-section" aria-labelledby="favorites-title">
          <div className="section-heading">
            <div><p className="eyebrow">STEP 2</p><h2 id="favorites-title">저장한 상권에서 비교할 곳을 고르세요</h2></div>
            <p>{selected.length}/4곳 선택</p>
          </div>
          {notice ? <p className="selection-notice" role="alert">{notice}</p> : null}
          {!favorites.length ? (
            <div className="empty-favorites">지도나 목록에서 별표를 눌러 관심 상권을 먼저 저장해 주세요.</div>
          ) : (
            <div className="favorite-grid">
              {favorites.map((code) => {
                const area = areaByCode.get(code);
                if (!area) return null;
                const isSelected = selected.includes(code);
                return (
                  <button className={`favorite-card ${isSelected ? "selected" : ""}`} onClick={() => handleCompare(code)} key={code}>
                    <span className="check">{isSelected ? "✓" : "+"}</span>
                    <span><small>{area.district_name} · {area.area_type_name}</small><strong>{area.name}</strong></span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="compare-bar">
            <p><strong>2~4곳</strong>을 선택하면 같은 기준분기로 비교할 수 있습니다.</p>
            <button disabled={selected.length < 2} onClick={goToCompare}>선택한 상권 비교하기 <span>→</span></button>
          </div>
        </section>
      </main>
    </div>
  );
}

