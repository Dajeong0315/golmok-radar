import { useEffect, useMemo, useState } from "react";

import { fetchAreaReviewReport, fetchIndustries, fetchReviewIndustryMapping, fetchTradeAreas } from "./api";
import { fetchAccountRecords, saveAccountRecord } from "./accountStore";
import { useAuth } from "./auth";
import { initialIndustry, rememberIndustry } from "./industrySelection";
import { searchNearbyIndustry, type KakaoPlace } from "./kakaoPlaces";
import type { AreaReviewReport, IndustryOption, ReviewIndustryMapping, TradeArea } from "./types";

export function ReviewAreaFlow() {
  const { client, user, session, signInWithKakao } = useAuth();
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const [industry, setIndustry] = useState(initialIndustry);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [mapping, setMapping] = useState<ReviewIndustryMapping | null>(null);
  const [areas, setAreas] = useState<TradeArea[]>([]);
  const [areaCode, setAreaCode] = useState(params.get("area") || "");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<KakaoPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AreaReviewReport | null>(null);
  const [error, setError] = useState("");
  const selectedArea = areas.find((item) => item.code === areaCode);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return areas.slice(0, 12);
    return areas.filter((item) => `${item.name} ${item.district_name}`.toLowerCase().includes(search)).slice(0, 20);
  }, [areas, query]);

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
    setAreas([]);
    Promise.all([fetchReviewIndustryMapping(industry, controller.signal), fetchTradeAreas(industry, controller.signal)])
      .then(([nextMapping, nextAreas]) => { setMapping(nextMapping); setAreas(nextAreas); })
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [industry]);

  useEffect(() => {
    const recordId = params.get("area_record");
    if (!recordId || !client || !user) return;
    let active = true;
    fetchAccountRecords(client, user.id, "area_review_report").then((records) => {
      const saved = records.find((item) => item.recordId === recordId)?.payload as AreaReviewReport | undefined;
      if (active && saved?.area && saved?.industry_code) {
        setIndustry(saved.industry_code);
        setAreaCode(saved.area.code);
        setReport(saved);
      }
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [client, user?.id]);

  useEffect(() => {
    if (!selectedArea || !mapping?.supported) return;
    let active = true;
    setSearching(true);
    setCandidates([]);
    setError("");
    searchNearbyIndustry(selectedArea.latitude, selectedArea.longitude, industry, mapping.terms, mapping.excluded_terms)
      .then((places) => { if (active) setCandidates(places); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setSearching(false); });
    return () => { active = false; };
  }, [selectedArea?.code, industry, mapping]);

  const run = async () => {
    if (!selectedArea || !session || running || candidates.length === 0) return;
    setRunning(true);
    setError("");
    setReport(null);
    try {
      const result = await fetchAreaReviewReport(selectedArea.code, industry, candidates, session.access_token);
      setReport(result);
      if (client && user) {
        const now = new Date().toISOString();
        try {
          await saveAccountRecord(client, user.id, {
            recordId: crypto.randomUUID(),
            kind: "area_review_report", title: `${selectedArea.name} · ${result.industry_name} 리뷰 표본 · ${new Date(result.captured_at || now).toLocaleString("ko-KR")}`,
            payload: result, schemaVersion: 1,
            createdAt: result.captured_at || now, updatedAt: now,
          });
        } catch (reason) {
          setError(`분석 결과는 표시되지만 내 기록에 저장하지 못했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "상권 리뷰 분석에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  };

  return <section className="review-auto review-area-flow" aria-labelledby="review-area-title">
    <div className="review-section-heading"><div><p className="eyebrow">창업 전 상권 살펴보기</p><h2 id="review-area-title">상권과 업종을 고르면 고객 반응을 모아 봅니다</h2></div><p>선택한 공식 상권 안에서 분류가 확인된 동종 가게 최대 10곳의 리뷰를 익명 집계합니다. 개별 가게의 평가로 해석하지 마세요.</p></div>
    <label className="review-industry-select">분석 업종 <select aria-label="상권 리뷰 업종" value={industry} onChange={(event) => {
      const code = event.target.value;
      setIndustry(code); rememberIndustry(code); setAreaCode(""); setCandidates([]); setReport(null);
      window.history.replaceState(null, "", `#reviews?industry=${code}`);
    }}>{industries.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    {mapping && !mapping.supported ? <p className="review-auto-note">{mapping.reason}</p> : null}
    <label className="review-area-query">상권 이름 또는 자치구 <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 성수역, 성동구" /></label>
    <div className="review-area-options" role="listbox" aria-label="공식 상권 검색 결과">{filtered.map((item) => <button type="button" role="option" aria-selected={areaCode === item.code} key={item.code} onClick={() => {
      setAreaCode(item.code); setReport(null);
      window.history.replaceState(null, "", `#reviews?area=${item.code}&industry=${industry}`);
    }}><strong>{item.name}</strong><small>{item.district_name} · {item.area_type_name}</small></button>)}</div>
    {selectedArea ? <div className="review-area-card"><small>선택한 공식 상권 · {mapping?.industry_name || industry}</small><strong>{selectedArea.district_name} · {selectedArea.name}</strong><p>공식 상권 코드 {selectedArea.code} · 2025년 4분기 점포 원천 {selectedArea.data_status.store ? "있음" : "없음"}</p></div> : null}
    {selectedArea && mapping?.supported ? <div className="review-run">
      <p>{searching ? "동종 가게 후보를 확인하는 중입니다." : `카카오 장소 검색에서 동종 후보 ${candidates.length}곳을 찾았습니다. 서버가 실제 분류와 상권 포함 여부를 다시 확인한 뒤 최대 10곳을 수집합니다.`}</p>
      {session ? <button type="button" disabled={searching || running || candidates.length === 0} onClick={() => void run()}>{running ? "공개 리뷰 표본 수집 중…" : "이 상권의 리뷰 표본 분석"}</button> : <button type="button" onClick={() => void signInWithKakao()}>카카오 로그인 후 분석하기</button>}
      {!searching && candidates.length === 0 ? <p>검색된 동종 가게가 없습니다. 다른 업종이나 상권을 선택해 주세요.</p> : null}
      <p>요청할 때마다 새로 수집합니다. 한 번에 최대 10곳, 가게당 공개 화면에서 확인되는 텍스트 리뷰 최대 40건을 사용합니다.</p>
    </div> : null}
    {error ? <p className="error-banner" role="alert">{error}</p> : null}
    {report ? <AreaReviewResult report={report} /> : null}
  </section>;
}

function AreaReviewResult({ report }: { report: AreaReviewReport }) {
  return <section className="review-auto-report" aria-live="polite">
    <div className="review-section-heading"><div><p className="eyebrow">상권 리뷰 표본 · {report.industry_name}</p><h2>{report.area.name}의 동종 가게 반응</h2></div><p>{report.message}</p></div>
    <div className="review-auto-metadata"><span>카카오 공개 리뷰</span><span>상권 {report.area.code} · 2025년 4분기 업종 분류</span><span>{!report.captured_at ? "수집 미실행" : report.from_cache ? "이전 보관본" : "이번 요청 신규 수집"}</span><span>분석 {report.analyzed_review_count}건 / 수집 {report.total_review_count}건</span><span>수집 {report.captured_at ? new Date(report.captured_at).toLocaleString("ko-KR") : "미실행"}</span><span>보관 만료 {report.expires_at ? new Date(report.expires_at).toLocaleDateString("ko-KR") : "해당 없음"}</span></div>
    <div className="review-auto-counts">{report.place_samples.map((sample) => <div key={sample.label}><small>가게 {sample.label}{sample.included_in_analysis ? "" : " · 분석 제외"}</small><strong>{sample.review_count}건</strong></div>)}</div>
    {report.failed_labels.length ? <p className="review-auto-note">수집 실패: {report.failed_labels.map((label) => `가게 ${label}`).join(", ")}. 자동 재시도는 하지 않았습니다.</p> : null}
    {report.topics.length ? <div className="review-auto-topics">{report.topics.filter((topic) => topic.mentions > 0).map((topic) => <article key={topic.topic_key}><h3>{topic.label}</h3><p>언급 {topic.mentions}회</p><small>긍정 {topic.positive} · 부정 {topic.negative} · 중립 {topic.neutral}</small></article>)}</div> : null}
    {report.analyzed_review_count > 0 && report.topics.every((topic) => topic.mentions === 0) ? <p className="review-auto-note">수집된 글에서 현재 주제 사전과 일치하는 표현은 확인되지 않았습니다.</p> : null}
    <p className="review-auto-note">리뷰가 있는 가게만 주제 집계에 포함합니다. 가게 이름과 리뷰 원문은 공개하지 않으며, 작은 표본은 상권 전체의 대표 의견이 아닙니다.</p>
  </section>;
}
