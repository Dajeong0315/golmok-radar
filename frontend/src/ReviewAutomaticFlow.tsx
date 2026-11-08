import { useEffect, useState, type FormEvent } from "react";

import { fetchCapturedReviewReport, fetchIndustries, fetchReviewIndustryMapping, fetchReviewTradeArea } from "./api";
import { fetchAccountRecords, saveAccountRecord } from "./accountStore";
import { useAuth } from "./auth";
import { matchesIndustryCategory, searchKakaoPlaces, searchNearbyIndustry, selectNearbyPlaces, type KakaoPlace } from "./kakaoPlaces";
import { initialIndustry, rememberIndustry } from "./industrySelection";
import { ReviewPlaceMap } from "./ReviewPlaceMap";
import type { CapturedReviewReport, IndustryOption, ReviewAreaLocation, ReviewIndustryMapping } from "./types";
import "./reviewAutomatic.css";

const SELECTED_SHOP_KEY = "golmok-radar:review-own-shop:v1";

function savedShop(): KakaoPlace | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SELECTED_SHOP_KEY) || "null") as KakaoPlace | null;
    return value && /^\d{1,15}$/.test(value.id) && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) ? value : null;
  } catch {
    return null;
  }
}

export function ReviewAutomaticFlow() {
  const { client, user, session, signInWithKakao } = useAuth();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<KakaoPlace[]>([]);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<KakaoPlace | null>(savedShop);
  const [area, setArea] = useState<ReviewAreaLocation | null>(null);
  const [nearby, setNearby] = useState<KakaoPlace[]>([]);
  const [report, setReport] = useState<CapturedReviewReport | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [industry, setIndustry] = useState(initialIndustry);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [mapping, setMapping] = useState<ReviewIndustryMapping | null>(null);
  const sortedMatches = mapping ? [...matches].sort((left, right) =>
    Number(matchesIndustryCategory(right.category, mapping.terms, mapping.excluded_terms))
    - Number(matchesIndustryCategory(left.category, mapping.terms, mapping.excluded_terms))) : matches;

  useEffect(() => {
    const controller = new AbortController();
    fetchIndustries(controller.signal).then(setIndustries).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setMapping(null);
    fetchReviewIndustryMapping(industry, controller.signal).then(setMapping).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [industry]);

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.hash.split("?")[1] || "").get("record");
    if (!recordId || !client || !user) return;
    let active = true;
    fetchAccountRecords(client, user.id, "review_report").then((records) => {
      const saved = records.find((record) => record.recordId === recordId)?.payload as CapturedReviewReport | undefined;
      if (active && saved && ["available", "limited", "insufficient_sample", "outside_trade_area"].includes(saved.status)) setReport(saved);
    }).catch((reason: Error) => { if (active) setError(`저장된 리뷰 기록을 불러오지 못했습니다: ${reason.message}`); });
    return () => { active = false; };
  }, [client, user?.id]);

  useEffect(() => {
    if (!selected || !locationConfirmed || !mapping?.supported) return;
    let active = true;
    setArea(null);
    setNearby([]);
    setLocating(true);
    setError("");
    Promise.all([
      fetchReviewTradeArea(selected),
      searchNearbyIndustry(selected.latitude, selected.longitude, industry, mapping.terms, mapping.excluded_terms),
    ]).then(([location, places]) => {
      if (!active) return;
      setArea(location);
      setNearby(selectNearbyPlaces(places, selected.id, 45));
    }).catch((reason: Error) => {
      if (active) setError(reason.message);
    }).finally(() => { if (active) setLocating(false); });
    return () => { active = false; };
  }, [selected?.id, locationConfirmed, industry, mapping]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (query.trim().length < 2) {
      setError("가게 이름을 두 글자 이상 입력해 주세요.");
      return;
    }
    setSearching(true);
    try {
      setMatches(await searchKakaoPlaces(query.trim()));
      setSearched(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "가게 검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  };

  const choose = (place: KakaoPlace) => {
    sessionStorage.setItem(SELECTED_SHOP_KEY, JSON.stringify(place));
    setSelected(place);
    setArea(null);
    setNearby([]);
    setReport(null);
    setConfirmed(false);
    setLocationConfirmed(false);
  };

  const runReport = async () => {
    if (!selected || !locationConfirmed || !area || !session || !confirmed || running) return;
    setRunning(true);
    setError("");
    setReport(null);
    try {
      const result = await fetchCapturedReviewReport(
        selected,
        nearby,
        session.access_token,
        confirmed,
        industry,
      );
      setReport(result);
      if (client && user) {
        const now = new Date().toISOString();
        try {
          await saveAccountRecord(client, user.id, {
            recordId: crypto.randomUUID(),
            kind: "review_report",
            title: `${selected.name} · ${mapping?.industry_name || industry} 리뷰 비교 · ${new Date(result.captured_at || now).toLocaleString("ko-KR")}`,
            payload: result,
            schemaVersion: 1,
            createdAt: result.captured_at || now,
            updatedAt: now,
          });
        } catch (reason) {
          setError(`비교 결과는 표시되지만 내 기록에 저장하지 못했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "리뷰 수집에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return <section className="review-auto" aria-labelledby="review-auto-title">
    <div className="review-section-heading">
      <div><p className="eyebrow">내 가게로 시작</p><h2 id="review-auto-title">가게를 고르면 상권과 주변 반응을 연결합니다</h2></div>
      <p>공식 업종을 고르고 카카오 장소 검색에서 내 가게를 선택하세요. 같은 업종의 주변 가게를 최대 9곳까지 익명 비교군으로 묶습니다.</p>
    </div>

    <label className="review-industry-select">분석 업종 <select aria-label="리뷰 분석 업종" value={industry} onChange={(event) => {
      const code = event.target.value;
      setIndustry(code); rememberIndustry(code); setLocationConfirmed(false); setSelected(null);
      setArea(null); setNearby([]); setReport(null); setMatches([]);
      sessionStorage.removeItem(SELECTED_SHOP_KEY);
    }}>{industries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    {mapping && !mapping.supported ? <p className="review-auto-note" role="status">{mapping.reason}</p> : null}

    <form className="review-shop-search" onSubmit={(event) => void search(event)}>
      <label htmlFor="review-shop-query">내 가게 이름</label>
      <div><input id="review-shop-query" value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); setMatches([]); }} placeholder="예: 성수 온더" autoComplete="off" /><button type="submit" disabled={searching}>{searching ? "검색 중" : "가게 찾기"}</button></div>
    </form>
    <div className={`review-shop-picker ${selected ? "has-preview" : ""}`}>
      <div>{matches.length ? <ul className="review-shop-results" aria-label="가게 검색 결과">{sortedMatches.map((place) => <li key={place.id}><button type="button" className={selected?.id === place.id ? "is-selected" : ""} onClick={() => choose(place)}><strong>{place.name}</strong><span>{place.roadAddress || place.address}</span><small>{place.category}{mapping && !matchesIndustryCategory(place.category, mapping.terms, mapping.excluded_terms) ? " · 선택 업종과 다름" : ""}</small></button></li>)}</ul> : searched && !searching ? <p className="review-auto-note">검색 결과가 없습니다. 지역 이름과 가게 이름을 함께 입력해 보세요.</p> : null}</div>
      {selected ? <ReviewPlaceMap key={selected.id} place={selected} categoryAllowed={Boolean(mapping?.supported && matchesIndustryCategory(selected.category, mapping.terms, mapping.excluded_terms))} onConfirm={() => setLocationConfirmed(true)} /> : null}
    </div>

    {selected ? <div className="review-selected-shop">
      <div><small>선택한 내 가게 {locationConfirmed ? "· 위치 확인 완료" : "· 지도에서 확인 대기"}</small><strong>{selected.name}</strong><span>{selected.roadAddress || selected.address}</span></div>
      <button type="button" onClick={() => { sessionStorage.removeItem(SELECTED_SHOP_KEY); setSelected(null); setArea(null); setReport(null); setNearby([]); setLocationConfirmed(false); }}>다른 가게 선택</button>
    </div> : null}
    {locating ? <p className="review-auto-note" role="status">공식 상권 경계와 주변 동종 가게를 확인하고 있습니다.</p> : null}
    {area?.area ? <div className="review-area-card"><small>{area.status === "inside" ? "가게가 속한 공식 상권" : "가장 가까운 공식 상권"}</small><strong>{area.area.district_name} · {area.area.name}</strong><p>{area.status === "inside" ? `공식 상권 코드 ${area.area.code} · 주변 ${mapping?.industry_name || "동종"} 후보 ${nearby.length}곳` : `가게가 상권 경계 밖에 있습니다. 경계까지 약 ${area.distance_m}m이며 소속 상권으로 단정하지 않습니다. 반경 1.2km의 동종 후보 ${nearby.length}곳과 비교할 수 있습니다.`}</p></div> : area?.status === "unmapped" ? <p className="review-auto-note">이 위치는 적재된 공식 상권 경계에서 멀어 소속 상권을 판별할 수 없습니다. 반경 1.2km의 동종 후보 {nearby.length}곳을 위치 기준으로 비교할 수 있습니다.</p> : null}

    {selected && area ? <div className="review-run">
      <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> 이 가게를 운영하거나 관리하며, 이 가게의 리뷰를 분석할 권한이 있습니다.</label>
      {session ? <button type="button" disabled={!confirmed || running || locating} onClick={() => void runReport()}>{running ? "최대 10곳의 공개 리뷰 수집 중…" : nearby.length ? "주변 리뷰 수집하고 비교하기" : "내 가게 리뷰 표본 확인하기"}</button> : <button type="button" onClick={() => void signInWithKakao()}>카카오 로그인 후 비교하기</button>}
      {!locating && nearby.length === 0 ? <p className="review-auto-note">주변 동종 후보가 없어 내 가게 리뷰만 확인합니다. 가게 간 비교는 제공하지 않습니다.</p> : null}
      <p>요청할 때마다 새로 수집합니다. 내 가게 포함 최대 10곳, 가게당 공개 화면에서 확인되는 텍스트 리뷰 최대 40건을 사용합니다. 공식 상권 밖에서는 반경 기준 동종 가게를 비교합니다.</p>
    </div> : null}
    {error ? <p className="error-banner" role="alert">{error}</p> : null}
    {report ? <ReviewCapturedResult report={report} /> : null}
  </section>;
}

function ReviewCapturedResult({ report }: { report: CapturedReviewReport }) {
  return <section className="review-auto-report" aria-live="polite">
    <div className="review-section-heading"><div><p className="eyebrow">자동 리뷰 리포트 · {report.industry_name || "커피-음료"}</p><h2>{report.status === "available" ? "내 가게와 주변 동종 가게의 반응" : report.status === "limited" ? "수집된 리뷰의 주제별 반응" : "공개 텍스트 리뷰를 확인하지 못했습니다"}</h2></div><p>{report.message}</p></div>
    <div className="review-auto-metadata"><span>카카오 공개 리뷰</span><span>{report.location_status === "inside" || !report.location_status ? "공식 상권 안" : "공식 상권 밖 · 반경 비교"}</span><span>{!report.captured_at ? "수집 미실행" : report.from_cache ? "이전 보관본" : "이번 요청 신규 수집"}</span><span>분석에 사용 {report.analyzed_review_count ?? report.total_review_count}건 / 수집 {report.total_review_count}건</span><span>수집 {report.captured_at ? new Date(report.captured_at).toLocaleString("ko-KR") : "미실행"}</span><span>보관 만료 {report.expires_at ? new Date(report.expires_at).toLocaleDateString("ko-KR") : "해당 없음"}</span></div>
    <div className="review-auto-counts"><div><small>내 가게</small><strong>{report.own_review_count}건</strong></div>{report.peer_samples.map((peer) => <div key={peer.label}><small>주변 {peer.label}{peer.same_trade_area ? " · 같은 상권" : " · 반경 주변"}{peer.included_in_analysis === false ? " · 분석 제외" : ""}</small><strong>{peer.review_count}건</strong></div>)}</div>
    {report.failed_labels.length ? <p className="review-auto-note">수집 실패: {report.failed_labels.map((label) => label === "OWN" ? "내 가게" : `주변 ${label}`).join(", ")}. 차단을 우회하거나 자동 재시도하지 않았습니다.</p> : null}
    {report.status === "available" || report.status === "limited" ? <><div className="review-auto-topics">{report.topics.filter((topic) => topic.own.mentions > 0 || topic.nearby.mentions > 0).map((topic) => <article key={topic.topic_key}><h3>{topic.label}</h3><p>내 가게 {report.own_review_count ? `${topic.own.mentions}회` : "표본 없음"} · 주변 {report.peer_samples.some((peer) => peer.review_count > 0) ? `${topic.nearby.mentions}회` : "표본 없음"}</p><small>부정 언급: 내 가게 {topic.own.negative}회 / 주변 {topic.nearby.negative}회</small></article>)}</div>{report.topics.every((topic) => topic.own.mentions === 0 && topic.nearby.mentions === 0) ? <p className="review-auto-note">수집된 글에서 현재 주제 사전과 일치하는 표현은 확인되지 않았습니다.</p> : null}{report.insights.length ? <div className="review-auto-insights"><h3>운영 점검 아이디어</h3>{report.insights.map((insight) => <article key={insight.topic_key}><strong>{insight.observation}</strong><p>{insight.action_idea}</p></article>)}</div> : null}</> : null}
    <p className="review-auto-note">비교군 상호와 리뷰 원문은 표시하지 않습니다. 표본의 주제별 언급은 전체 고객 의견이나 창업 성과를 대표하지 않습니다.</p>
  </section>;
}
