import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchAreaMapInsight, fetchIndustries, fetchTradeAreas } from "./api";
import { fetchAccountFavorites, removeAccountFavorite, saveAccountFavorite } from "./accountStore";
import { AreaMapInsight } from "./AreaMapInsight";
import { FAVORITES_KEY, loadFavorites, mayImportLocalData, mayReadLocalData, mergeFavorites, sanitizeFavorites, toggleComparison, toggleFavorite } from "./favorites";
import { useAuth } from "./auth";
import { registerAnonymousRecord } from "./anonymousSession";
import { KakaoMap } from "./KakaoMap";
import { TopNavigation } from "./TopNavigation";
import { initialIndustry, rememberIndustry } from "./industrySelection";
import type { AreaMapInsightResponse, IndustryOption, TradeArea } from "./types";
import "./styles.css";


export default function App() {
  const { client, user } = useAuth();
  const [areas, setAreas] = useState<TradeArea[]>([]);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [industry, setIndustry] = useState(initialIndustry);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites(localStorage, user?.id ?? null));
  const [selected, setSelected] = useState<string[]>([]);
  const [district, setDistrict] = useState("전체");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [focusedMapCode, setFocusedMapCode] = useState(() => new URLSearchParams(window.location.hash.split("?", 2)[1] || "").get("focus") || "");
  const [mapInsight, setMapInsight] = useState<AreaMapInsightResponse | null>(null);
  const [mapInsightLoading, setMapInsightLoading] = useState(false);
  const [mapInsightError, setMapInsightError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchTradeAreas(industry, controller.signal)
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
  }, [industry]);

  useEffect(() => {
    const controller = new AbortController();
    fetchIndustries(controller.signal)
      .then((data) => setIndustries(data))
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!user && !mayReadLocalData(localStorage, null)) {
      setFavorites([]);
      setSelected([]);
      return;
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    if (!user && favorites.length) registerAnonymousRecord(localStorage);
    setSelected((current) => current.filter((code) => favorites.includes(code)));
  }, [favorites, user]);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void fetchAccountFavorites(client, user.id).then(async (remote) => {
      if (!active) return;
      const local = mayImportLocalData(localStorage, user.id) ? favorites : [];
      const merged = mergeFavorites(local, remote);
      setFavorites(merged);
      await Promise.all(merged.filter((code) => !remote.includes(code)).map((code) => saveAccountFavorite(client, user.id, code)));
      if (active) setNotice("카카오 계정에 관심 상권을 동기화했습니다.");
    }).catch((reason: Error) => {
      if (active) setNotice(`계정 동기화에 실패했습니다: ${reason.message}`);
    });
    return () => { active = false; };
  }, [client, user?.id]);

  useEffect(() => {
    if (!focusedMapCode) {
      setMapInsight(null);
      setMapInsightError("");
      return;
    }
    const controller = new AbortController();
    setMapInsight(null);
    setMapInsightLoading(true);
    setMapInsightError("");
    fetchAreaMapInsight(focusedMapCode, industry, controller.signal)
      .then(setMapInsight)
      .catch((reason: Error) => { if (reason.name !== "AbortError") setMapInsightError(reason.message); })
      .finally(() => setMapInsightLoading(false));
    return () => controller.abort();
  }, [focusedMapCode, industry]);

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
  const focusedMapArea = areas.find((area) => area.code === focusedMapCode);
  const mapAreas = focusedMapArea ? [focusedMapArea] : filteredAreas;
  const displayedAreas = district === "전체" && !query.trim() ? filteredAreas.slice(0, 80) : filteredAreas;
  const selectedIndustry = industries.find((item) => item.code === industry);

  const handleFavorite = useCallback((code: string) => {
    setFavorites((current) => {
      const isSaved = current.includes(code);
      const next = toggleFavorite(current, code);
      if (client && user) {
        const request = isSaved ? removeAccountFavorite(client, user.id, code) : saveAccountFavorite(client, user.id, code);
        void request.catch((reason: Error) => setNotice(`계정 동기화에 실패했습니다: ${reason.message}`));
      }
      return next;
    });
  }, [client, user]);

  const handleCompare = (code: string) => {
    const next = toggleComparison(selected, code);
    setSelected(next.codes);
    setNotice(next.limitReached ? "한 번에 최대 네 곳까지 비교할 수 있습니다." : "");
  };

  const goToCompare = () => {
    if (selected.length < 2) return;
    window.location.hash = `compare?codes=${selected.join(",")}&industry=${industry}`;
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="골목 레이더 홈">
          <span className="brand-mark">G</span>
          <span>골목 레이더</span>
        </a>
        <TopNavigation active="explore" />
        <div className="header-context"><span>서울 · {selectedIndustry?.name || "카페"}</span><strong>2025년 4분기</strong></div>
      </header>

      <main id="explore">
        <div className="explore-intro"><p className="eyebrow">서울 공식 상권 탐색</p><h1>어느 골목이 궁금하세요?</h1><p>상권을 선택해 통계를 확인하고, 관심 상권 2~4곳을 같은 기준으로 비교하세요.</p></div>

        <section className="explorer" aria-labelledby="explorer-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">지도에서 후보 찾기</p>
              <h2 id="explorer-title">궁금한 상권을 별표로 저장하세요</h2>
            </div>
            <p>{user ? "카카오 계정과 이 브라우저에 함께 저장돼요." : "로그인 없이 이 브라우저에 저장돼요. 카카오 로그인 시 다른 기기에서도 볼 수 있어요."}</p>
          </div>

          <div className="filters">
            <label className="district-select"><span>업종</span><select aria-label="업종 필터" value={industry} onChange={(event) => { const code = event.target.value; setIndustry(code); rememberIndustry(code); setFocusedMapCode(""); window.history.replaceState(null, "", `#explore?industry=${code}`); }}>
              {industries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select></label>
            <label className="district-select"><span>자치구</span><select aria-label="자치구 필터" value={district} onChange={(event) => setDistrict(event.target.value)}>{districts.map((item) => <option key={item} value={item}>{item === "전체" ? "서울 전체" : item}</option>)}</select></label>
            <label className="search-field">
              <span className="sr-only">상권 이름 검색</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="상권 이름을 검색하세요" />
              <span>⌕</span>
            </label>
          </div>
          <p className="filter-help">2025년 4분기 공식 점포 원천의 100개 업종을 볼 수 있습니다. 일부 업종에는 매출 원천이 없어 해당 지표가 비교 불가로 표시됩니다.</p>

          {error ? <div className="error-banner">{error} API 서버의 실행 상태와 최신 코드 반영 여부를 확인해 주세요.</div> : null}
          <div className="explorer-grid">
            <KakaoMap areas={mapAreas} favorites={favoriteCodes} onSelectArea={setFocusedMapCode} selectedCode={focusedMapArea?.code} showDistrictGuide={!focusedMapArea && district === "전체" && !query.trim()} />
            <div className="area-panel">
              <div className="area-panel__header"><strong>상권 목록</strong><span>{filteredAreas.length}곳</span></div>
              {loading ? <p className="panel-state">상권 데이터를 불러오는 중입니다.</p> : null}
              {!loading && !filteredAreas.length ? <p className="panel-state">조건에 맞는 상권이 없습니다.</p> : null}
              {!loading && displayedAreas.length < filteredAreas.length ? <p className="panel-state panel-hint">먼저 80곳만 보여드려요. 자치구를 고르거나 이름을 검색하면 원하는 상권을 빠르게 찾을 수 있어요.</p> : null}
              <div className="area-list">
                {displayedAreas.map((area) => (
                  <article className={`area-card ${focusedMapArea?.code === area.code ? "is-map-focused" : ""}`} key={area.code} tabIndex={0} role="button" aria-label={`${area.name} 지도에서 보기`} onClick={() => setFocusedMapCode(area.code)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setFocusedMapCode(area.code); } }}>
                    <button className={`favorite-button ${favorites.includes(area.code) ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); handleFavorite(area.code); }} aria-label={`${area.name} 관심 상권 ${favorites.includes(area.code) ? "해제" : "추가"}`}>{favorites.includes(area.code) ? "★" : "☆"}</button>
                    <div>
                      <span className="area-meta">{area.district_name} · {area.area_type_name}</span>
                      <h3>{area.name}</h3>
                      <div className="data-badges">
                        <span className={area.data_status.store ? "ok" : "missing"}>점포 {area.data_status.store ? "통계 있음" : "원천 없음"}</span>
                        <span className={area.data_status.sales ? "ok" : "missing"}>매출 {area.data_status.sales ? "통계 있음" : "원천 없음"}</span>
                        <span className={area.data_status.population ? "ok" : "missing"}>유동 {area.data_status.population ? "통계 있음" : "원천 없음"}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
          <AreaMapInsight data={mapInsight} loading={mapInsightLoading} error={mapInsightError} />
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

