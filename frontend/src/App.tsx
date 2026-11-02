import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchTradeAreas } from "./api";
import { FAVORITES_KEY, loadFavorites, sanitizeFavorites, toggleComparison, toggleFavorite } from "./favorites";
import { KakaoMap } from "./KakaoMap";
import type { TradeArea } from "./types";
import "./styles.css";


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
  const districts = useMemo(() => ["전체", ...new Set(areas.map((area) => area.district_name))].sort((a, b) => a === "전체" ? -1 : b === "전체" ? 1 : a.localeCompare(b, "ko")), [areas]);
  const favoriteCodes = useMemo(() => new Set(favorites), [favorites]);
  const filteredAreas = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return areas.filter((area) => {
      const districtMatch = district === "전체" || area.district_name === district;
      const queryMatch = !normalized || `${area.district_name} ${area.name} ${area.area_type_name}`.toLowerCase().includes(normalized);
      return districtMatch && queryMatch;
    });
  }, [areas, district, query]);
  const mapAreas = district === "전체" && !query.trim() ? [] : filteredAreas;
  const displayedAreas = district === "전체" && !query.trim() ? filteredAreas.slice(0, 80) : filteredAreas;

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
          <a href="#workflow">사용 흐름</a>
          <a href="#quiz">창업 성향 진단</a>
          <a href="#worksheet">매물 검증</a>
          <a href="#reviews">리뷰 분석 · 준비 중</a>
          <span>서울 · 카페</span>
          <strong>2025년 4분기</strong>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <p className="eyebrow">상권 통계 → 매물 검증</p>
          <h1>첫 계약 전,<br />확인할 일을 순서대로.</h1>
          <p className="hero-copy">상권 후보를 같은 기준으로 비교하고, 직접 찾은 매물과 현장을 기록하세요.<br />골목 레이더는 추천이나 계약 판정 대신 확인해야 할 근거와 다음 행동을 연결합니다.</p>
          <div className="hero-actions"><a className="primary-action" href="#workflow">사용 흐름 먼저 보기 <span>→</span></a><a className="hero-text-link" href="#explorer-title">바로 상권 탐색하기</a></div>
          <div className="hero-proof">
            <span><b>{loading ? "—" : areas.length.toLocaleString("ko-KR")}</b> 공식 상권</span>
            <span><b>{loading ? "—" : Math.max(districts.length - 1, 0)}</b> 서울 자치구</span>
            <span><b>14</b> 비교 지표</span>
            <span><b>모든 수치</b> 출처 확인</span>
          </div>
        </section>

        <section className="starter-pipeline" aria-labelledby="pipeline-title">
          <div className="section-heading"><div><p className="eyebrow">이용 순서</p><h2 id="pipeline-title">지금 어디까지 준비했나요?</h2></div><p><a className="workflow-inline-link" href="#workflow">전체 사용 흐름 보기 →</a></p></div>
          <ol>
            <li><span>01</span><strong>탐색</strong><p>조건을 정리하고 서울 공식 상권을 저장해요.</p><a href="#quiz">조건 정리하기</a></li>
            <li><span>02</span><strong>비교</strong><p>관심 상권 2~4곳의 같은 기준분기 지표를 봐요.</p><a href="#explorer-title">상권 찾기</a></li>
            <li><span>03</span><strong>검증</strong><p>직접 본 매물 비용과 현장 확인 상태를 남겨요.</p><a href="#worksheet">매물 기록하기</a></li>
            <li><span>04</span><strong>의사결정 준비</strong><p>공식 지원 정보와 전문가 확인이 남은 항목을 점검해요.</p><a href="#funding">공식 정보 보기</a></li>
          </ol>
        </section>

        <section className="explorer" aria-labelledby="explorer-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">지도에서 후보 찾기</p>
              <h2 id="explorer-title">궁금한 상권을 별표로 저장하세요</h2>
            </div>
            <p>로그인 없이 지금 쓰는 브라우저에 저장돼요.</p>
          </div>

          <div className="filters">
            <label className="district-select"><span>자치구</span><select aria-label="자치구 필터" value={district} onChange={(event) => setDistrict(event.target.value)}>{districts.map((item) => <option key={item} value={item}>{item === "전체" ? "서울 전체" : item}</option>)}</select></label>
            <label className="search-field">
              <span className="sr-only">상권 이름 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상권 이름을 검색하세요" />
              <span>⌕</span>
            </label>
          </div>

          {error ? <div className="error-banner">{error} 백엔드 서버가 실행 중인지 확인해 주세요.</div> : null}
          <div className="explorer-grid">
            <KakaoMap areas={mapAreas} favorites={favoriteCodes} onToggleFavorite={handleFavorite} showDistrictGuide={district === "전체" && !query.trim()} />
            <div className="area-panel">
              <div className="area-panel__header"><strong>상권 목록</strong><span>{filteredAreas.length}곳</span></div>
              {loading ? <p className="panel-state">상권 데이터를 불러오는 중입니다.</p> : null}
              {!loading && !filteredAreas.length ? <p className="panel-state">조건에 맞는 상권이 없습니다.</p> : null}
              {!loading && displayedAreas.length < filteredAreas.length ? <p className="panel-state panel-hint">먼저 80곳만 보여드려요. 자치구를 고르거나 이름을 검색하면 원하는 상권을 빠르게 찾을 수 있어요.</p> : null}
              <div className="area-list">
                {displayedAreas.map((area) => (
                  <article className="area-card" key={area.code}>
                    <button className={`favorite-button ${favorites.includes(area.code) ? "active" : ""}`} onClick={() => handleFavorite(area.code)} aria-label={`${area.name} 관심 상권 ${favorites.includes(area.code) ? "해제" : "추가"}`}>{favorites.includes(area.code) ? "★" : "☆"}</button>
                    <div>
                      <span className="area-meta">{area.district_name} · {area.area_type_name}</span>
                      <h3>{area.name}</h3>
                      <div className="data-badges">
                        <span className={area.data_status.sales ? "ok" : "missing"}>매출 {area.data_status.sales ? "있음" : "없음"}</span>
                        <span className={area.data_status.population ? "ok" : "missing"}>인구 {area.data_status.population ? "있음" : "없음"}</span>
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
            <div><p className="eyebrow">같은 기준으로 비교하기</p><h2 id="favorites-title">저장한 곳 중 2~4곳을 골라 주세요</h2></div>
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

