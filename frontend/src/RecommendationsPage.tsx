import { useEffect, useState } from "react";

import { fetchRecommendations } from "./api";
import { FAVORITES_KEY, loadFavorites } from "./favorites";
import { loadProfile } from "./founderProfile";
import type { RecommendationResponse } from "./types";

export function RecommendationsPage() {
  const profile = loadProfile(localStorage);
  const [data, setData] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    fetchRecommendations(profile.answers, controller.signal).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, []);

  if (!profile) return <RecommendationState title="먼저 창업 성향을 알려주세요" copy="여섯 가지 답변이 있어야 후보 조건을 만들 수 있습니다." action="#quiz" actionLabel="성향 진단 시작" />;
  if (error) return <RecommendationState title="후보를 불러오지 못했습니다" copy={error} action="#top" actionLabel="상권 직접 탐색" />;
  if (!data) return <RecommendationState title="상권 후보를 찾는 중입니다" copy="82개 비교 가능 상권의 지표를 같은 기준으로 정렬하고 있습니다." />;
  if (data.status === "unsupported_business") return <RecommendationState title="이 업종의 추천 데이터는 준비 중입니다" copy={data.message} action="#top" actionLabel="상권 직접 탐색" secondary="#quiz" secondaryLabel="업종 답변 수정" />;

  const codes = data.candidates.map((candidate) => candidate.trade_area.code);
  const saveAndExplore = () => {
    const current = loadFavorites(localStorage);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set([...current, ...codes])]));
    window.location.hash = `compare?codes=${codes.join(",")}`;
  };

  return <main className="recommendation-page">
    <header className="site-header recommendation-header"><a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a><a className="back-link" href="#quiz">성향 결과 다시 보기</a></header>
    <section className="recommendation-hero">
      <div><p className="eyebrow">EXPLAINABLE SHORTLIST</p><h1>당신의 조건과<br /><em>먼저 비교해 볼 3곳</em></h1><p>{data.message}</p></div>
      <aside><strong>{data.candidate_pool_size}</strong><span>비교 가능한 카페 상권</span><small>{data.quarter_label} · 가중치 {data.weights_version}</small></aside>
    </section>
    <section className="candidate-list" aria-label="추천 상권 후보">
      {data.candidates.map((candidate) => <article className="candidate-card" key={candidate.trade_area.code}>
        <div className="candidate-rank"><span>0{candidate.rank}</span><small>조건 적합도</small><strong>{candidate.score}</strong><em>/ 100</em></div>
        <div className="candidate-main"><small>{candidate.trade_area.district_name} · {candidate.trade_area.area_type_name}</small><h2>{candidate.trade_area.name}</h2><p>데이터 완전성 {candidate.data_completeness}</p>
          <div className="candidate-reasons"><h3>이 후보가 먼저 나온 이유</h3>{candidate.reasons.map((reason) => <div key={`${candidate.trade_area.code}-${reason.metric_key}`}><strong>{reason.label}</strong><span>{reason.value.toLocaleString("ko-KR")} {reason.unit}</span><p>{reason.explanation} · 가중치 {reason.weight}</p></div>)}</div>
        </div>
        <aside className="candidate-cautions"><h3>현장에서 확인할 점</h3>{candidate.cautions.map((caution) => <p key={caution}>{caution}</p>)}</aside>
      </article>)}
    </section>
    <section className="recommendation-method"><div><p className="eyebrow">HOW IT WORKS</p><h2>점수보다<br />이유를 보세요.</h2></div><div><p>모든 지표를 비교 가능한 카페 상권 {data.candidate_pool_size}곳 안에서 백분위로 바꾸고, 진단 답변에 공개된 가중치를 적용했습니다.</p><p>{data.diversity_rule}</p><p>조건 적합도는 창업 성공 확률이 아닙니다. 후보를 빠르게 좁히기 위한 탐색 순서입니다.</p></div></section>
    <section className="recommendation-cta"><div><p className="eyebrow">NEXT STEP</p><h2>세 후보의 14개 지표를<br />같은 표에서 확인하세요.</h2></div><button className="primary-action" onClick={saveAndExplore}>관심 목록에 저장하고 비교 <span>→</span></button></section>
  </main>;
}

function RecommendationState({ title, copy, action, actionLabel, secondary, secondaryLabel }: { title: string; copy: string; action?: string; actionLabel?: string; secondary?: string; secondaryLabel?: string }) {
  return <main className="compare-state"><span className={action ? "state-mark" : "state-pulse"}>{action ? "!" : ""}</span><p className="eyebrow">골목 레이더</p><h1>{title}</h1><p>{copy}</p>{action ? <a href={action}>{actionLabel}</a> : null}{secondary ? <a href={secondary}>{secondaryLabel}</a> : null}</main>;
}
