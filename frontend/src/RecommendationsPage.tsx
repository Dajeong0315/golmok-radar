import { useEffect, useState } from "react";

import { fetchAreaReport, fetchIndustries, fetchRecommendations } from "./api";
import { fetchAccountRecords, profileFromAccountRecord, saveAccountFavorite } from "./accountStore";
import { registerAnonymousRecord } from "./anonymousSession";
import { FAVORITES_KEY, loadFavorites } from "./favorites";
import { loadProfile, type FounderProfile } from "./founderProfile";
import type { AreaReportResponse, IndustryOption, RecommendationResponse } from "./types";
import { TopNavigation } from "./TopNavigation";
import { useAuth } from "./auth";
import { initialIndustry, rememberIndustry } from "./industrySelection";

export function RecommendationsPage() {
  const { client, transferStatus, user } = useAuth();
  const [profile, setProfile] = useState<FounderProfile | null>(() => loadProfile(localStorage, user?.id ?? null));
  const [profileLoading, setProfileLoading] = useState(Boolean(client && user && !profile));
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [reports, setReports] = useState<Record<string, AreaReportResponse>>({});
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [industry, setIndustry] = useState(initialIndustry);

  useEffect(() => {
    const controller = new AbortController();
    fetchIndustries(controller.signal).then(setIndustries).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!client || !user || profile) return;
    let active = true;
    setProfileLoading(true);
    fetchAccountRecords(client, user.id, "founder_profile")
      .then((records) => {
        if (active) setProfile(records.map(profileFromAccountRecord).find((item): item is FounderProfile => item !== null) || null);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [client, user?.id, transferStatus, profile]);

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    setData(null);
    setReports({});
    setError("");
    fetchRecommendations(profile.answers, industry, controller.signal).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [profile, industry]);

  useEffect(() => {
    if (!data?.candidates.length) return;
    const controller = new AbortController();
    Promise.all(data.candidates.map((candidate) => fetchAreaReport(candidate.trade_area.code, industry, controller.signal)))
      .then((items) => setReports(Object.fromEntries(items.map((report) => [report.trade_area.code, report]))))
      .catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [data, industry]);

  const picker = <label className="district-select recommendation-industry"><span>후보 업종</span><select aria-label="후보 업종" value={industry} onChange={(event) => { const code = event.target.value; setIndustry(code); rememberIndustry(code); window.history.replaceState(null, "", `#recommendations?industry=${code}`); }}>
    {industries.map((item) => <option key={item.code} value={item.code}>{item.name}{item.has_sales_source ? "" : " · 매출 원천 없음"}</option>)}
  </select></label>;

  if (!profile && profileLoading) return <RecommendationState title="저장한 결과를 불러오는 중이에요" copy="카카오 계정의 창업 조건을 확인하고 있어요." />;
  if (!profile) return <RecommendationState title="먼저 원하는 가게를 알려주세요" copy="여섯 가지 쉬운 질문에 답하면 상권 후보를 찾을 기준이 생겨요." action="#quiz" actionLabel="성향 진단 시작" />;
  if (error) return <>{picker}<RecommendationState title="후보를 불러오지 못했습니다" copy={error} action={`#explore?industry=${industry}`} actionLabel="상권 직접 탐색" /></>;
  if (!data) return <>{picker}<RecommendationState title="상권 후보를 찾는 중이에요" copy="선택 업종의 점포·매출·유동인구를 같은 기준으로 살펴보고 있어요." /></>;
  if (data.status === "unsupported_business") return <>{picker}<RecommendationState title="이 업종의 비교 자료가 부족합니다" copy={data.message} action={`#explore?industry=${industry}`} actionLabel="상권 직접 탐색" secondary="#quiz" secondaryLabel="진단 답변 수정" /></>;

  const codes = data.candidates.map((candidate) => candidate.trade_area.code);
  const saveAndExplore = async () => {
    setSaveError("");
    const current = loadFavorites(localStorage, user?.id ?? null);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set([...current, ...codes])]));
    if (!user) registerAnonymousRecord(localStorage);
    if (client && user) {
      setSaving(true);
      try {
        await Promise.all(codes.map((code) => saveAccountFavorite(client, user.id, code)));
      } catch (reason) {
        setSaveError(reason instanceof Error ? `계정에 저장하지 못했습니다: ${reason.message}` : "계정에 저장하지 못했습니다.");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    window.location.hash = `compare?codes=${codes.join(",")}&industry=${industry}`;
  };

  return <main className="recommendation-page">
    <header className="site-header recommendation-header"><a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation active="explore" /><a className="back-link" href="#quiz">조건 다시 보기</a></header>
    {picker}
    <section className="recommendation-hero">
      <div><p className="eyebrow">첫 번째 후보 리포트</p><h1>내 답과 잘 맞는 상권 3곳을<br />먼저 살펴보세요.</h1><p>{data.message}</p></div>
      <aside><strong>{data.candidate_pool_size}</strong><span>{data.industry_name} 비교 상권</span><small>{data.quarter_label} · 계산 기준 {data.weights_version}</small></aside>
    </section>
    <section className="recommendation-summary" aria-label="후보 리포트 읽는 순서"><strong>이 페이지를 보는 순서</strong><ol><li><span>1</span>상권마다 먼저 나온 이유를 봐요.</li><li><span>2</span>강점과 주의 신호를 같이 봐요.</li><li><span>3</span>마음에 들면 비교표에 담아요.</li></ol></section>
    <section className="candidate-list" aria-label="추천 상권 후보">
      {data.candidates.map((candidate) => <article className="candidate-card" key={candidate.trade_area.code}>
        <div className="candidate-rank"><span>0{candidate.rank}</span><small>내 답과 맞는 정도</small><strong>{candidate.score}</strong><em>/ 100 · 성공 확률 아님</em></div>
        <div className="candidate-main"><small>{candidate.trade_area.district_name} · {candidate.trade_area.area_type_name}</small><h2>{candidate.trade_area.name}</h2><p>데이터 완전성 {candidate.data_completeness}</p>
          <div className="candidate-reasons"><h3>이 상권을 먼저 보여드린 이유</h3>{candidate.reasons.map((reason) => <div key={`${candidate.trade_area.code}-${reason.metric_key}`}><strong>{reason.label}</strong><span>{reason.value.toLocaleString("ko-KR")} {reason.unit}</span><div className="signal-track" role="progressbar" aria-label={`${reason.label} 비교 위치`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reason.percentile}><i style={{ width: `${reason.percentile}%` }} /></div><p>비교 상권 중 {reason.percentile} 백분위 · 반영 비중 {reason.weight}</p></div>)}</div>
          {reports[candidate.trade_area.code] ? <AreaReport report={reports[candidate.trade_area.code]} comparisonCodes={codes} /> : <p className="report-loading">강점·주의점 리포트를 불러오는 중입니다.</p>}
          <a className="rent-link" href={`#rent?code=${candidate.trade_area.code}`}>이 상권의 임대 비용 검토 →</a>
        </div>
        <aside className="candidate-cautions"><h3>방문해서 꼭 볼 것</h3>{candidate.cautions.map((caution) => <p key={caution}>{caution}</p>)}</aside>
      </article>)}
    </section>
    <section className="recommendation-method"><div><p className="eyebrow">계산 방법</p><h2>점수보다 나온 이유를<br />확인하세요.</h2></div><div><p>{data.industry_name}의 점포·매출·유동인구 중 비교 가능한 지표를 상권 {data.candidate_pool_size}곳에서 같은 기준으로 줄 세웠어요. 매출 원천이 없는 업종은 매출을 점수에 넣지 않습니다.</p><p>{data.diversity_rule}</p><p>조건 적합도는 창업 성공 확률이 아니에요. 어디부터 더 자세히 볼지 정하는 탐색 순서입니다.</p></div></section>
    <section className="recommendation-cta"><div><p className="eyebrow">다음 단계</p><h2>세 후보의 지표를<br />같은 표에서 확인하세요.</h2>{saveError ? <p role="alert">{saveError}</p> : null}</div><button className="primary-action" onClick={() => void saveAndExplore()} disabled={saving}>{saving ? "계정에 저장 중" : "3곳을 저장하고 비교하기"} <span>→</span></button></section>
  </main>;
}

function AreaReport({ report, comparisonCodes }: { report: AreaReportResponse; comparisonCodes: string[] }) {
  const groups = [
    { label: "상대적 강점", className: "strength", items: report.strengths },
    { label: "주의 신호", className: "caution", items: report.cautions },
    { label: "수요·경쟁 특성", className: "context", items: report.characteristics },
  ];
  return <section className="area-report" aria-label={`${report.trade_area.name} 강점과 주의점 리포트`}>
    <div className="area-report__heading"><div><p className="eyebrow">상권 한눈에 보기</p><h3>강점과 주의 신호</h3></div><span>{report.industry_name} · {report.comparison_count}개 상권 비교 · {report.quarter_label}</span></div>
    <div className="report-groups">{groups.map((group) => <div className={group.className} key={group.label}><h4>{group.label}</h4>{group.items.length ? group.items.slice(0, 3).map((item) => <article data-metric-key={item.metric_key} key={item.metric_key}><strong>{item.label}</strong><span>{item.value?.toLocaleString("ko-KR")} {item.unit} · {item.percentile} 백분위</span>{item.percentile !== null ? <div className="report-track" role="progressbar" aria-label={`${item.label} 비교 위치`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.percentile}><i style={{ width: `${item.percentile}%` }} /></div> : null}<p>{item.summary}</p></article>) : <p>뚜렷하게 높거나 낮은 신호가 없어요.</p>}</div>)}</div>
    <footer><p>{report.notice}</p><a href={`#compare?codes=${comparisonCodes.join(",")}&industry=${report.industry_code}`}>비교표에서 수치와 근거 보기 →</a></footer>
  </section>;
}

function RecommendationState({ title, copy, action, actionLabel, secondary, secondaryLabel }: { title: string; copy: string; action?: string; actionLabel?: string; secondary?: string; secondaryLabel?: string }) {
  return <main className="compare-state"><span className={action ? "state-mark" : "state-pulse"}>{action ? "!" : ""}</span><p className="eyebrow">골목 레이더</p><h1>{title}</h1><p>{copy}</p>{action ? <a href={action}>{actionLabel}</a> : null}{secondary ? <a href={secondary}>{secondaryLabel}</a> : null}</main>;
}
