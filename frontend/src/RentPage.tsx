import { useEffect, useMemo, useState } from "react";

import { fetchRentBenchmark, fetchRentMarkets } from "./api";
import { calculateRent, compareWithSeoul, estimateRentFromOfficialRate, roundBenchmarkValue } from "./rentCalculator";
import type { RentBenchmarkResponse, RentMarketListResponse } from "./types";
import { TopNavigation } from "./TopNavigation";

type RentMetric = RentBenchmarkResponse["metrics"][number];

function findMetric(metrics: RentMetric[], key: string): RentMetric | undefined {
  return metrics.find((metric) => metric.metric_key === key);
}

function formatMetric(metric: RentMetric | undefined): string {
  return metric ? `${roundBenchmarkValue(metric.value).toLocaleString("ko-KR")} ${metric.unit}` : "비교 불가";
}

export function RentPage({ code }: { code: string }) {
  const [benchmark, setBenchmark] = useState<RentBenchmarkResponse | null>(null);
  const [marketList, setMarketList] = useState<RentMarketListResponse | null>(null);
  const [selectedMarketCode, setSelectedMarketCode] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ deposit: 3000, monthlyRent: 200, managementFee: 30, areaM2: 33, expectedMonthlySales: 2000 });

  useEffect(() => {
    const controller = new AbortController();
    fetchRentMarkets(controller.signal).then(setMarketList).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    setError("");
    fetchRentBenchmark(code, selectedMarketCode || undefined, controller.signal).then(setBenchmark).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [code, selectedMarketCode]);

  const result = useMemo(() => calculateRent({
    deposit: form.deposit * 10_000,
    monthlyRent: form.monthlyRent * 10_000,
    managementFee: form.managementFee * 10_000,
    areaM2: form.areaM2,
    expectedMonthlySales: form.expectedMonthlySales * 10_000,
  }), [form]);

  const officialRate = findMetric(benchmark?.metrics || [], "rent_per_sqm")?.value ?? null;
  const seoulRate = findMetric(benchmark?.seoul_metrics || [], "rent_per_sqm")?.value ?? null;
  const officialAreaEstimate = estimateRentFromOfficialRate(officialRate, form.areaM2);
  const differenceFromSeoul = compareWithSeoul(officialRate, seoulRate);

  if (!code) return <main className="compare-state"><span className="state-mark">!</span><h1>상권을 먼저 선택해 주세요.</h1><a href="#recommendations">후보 상권 보기</a></main>;

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));
  const selectedMarketName = marketList?.markets.find((market) => market.region_code === selectedMarketCode)?.name;

  return <main className="rent-page">
    <header className="site-header recommendation-header"><a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation active="worksheet" /><a className="back-link" href="#explore">상권 탐색</a></header>
    <section className="rent-hero"><p className="eyebrow">임대 비용 확인</p><h1>{benchmark?.trade_area.name || "후보 상권"}에서<br />얼마가 들지 확인하세요.</h1><p>먼저 공식 지역 통계로 가격대를 보고, 실제로 찾은 매물의 보증금과 월세를 넣어 한 달 비용을 계산해 보세요.</p></section>
    {error ? <p className="error-banner">{error}</p> : null}

    <section className="rent-market-section">
      <div className="rent-market-heading">
        <div><p className="eyebrow">공식 임대 통계</p><h2>지역 평균부터 확인하기</h2><p>한국부동산원이 조사하는 서울 상권 중 실제 후보지와 가까운 곳을 직접 골라 비교합니다.</p></div>
        <label className="rent-market-select"><span>가까운 공식 조사상권</span><select value={selectedMarketCode} onChange={(event) => setSelectedMarketCode(event.target.value)}><option value="">서울 전체 평균</option>{marketList?.markets.map((market) => <option key={market.region_code} value={market.region_code}>{market.group} · {market.name}</option>)}</select><small>{marketList?.notice || "공식 조사상권을 불러오고 있습니다."}</small></label>
      </div>

      {benchmark ? <>
        <div className="rent-market-summary">
          <article><span>보고 있는 통계 지역</span><strong>{selectedMarketName || "서울 전체"}</strong><small>{benchmark.source_period || "기준기간 확인 중"}</small></article>
          <article><span>소규모상가 임대료</span><strong>{formatMetric(findMetric(benchmark.metrics, "rent_per_sqm"))}</strong><small>{differenceFromSeoul === null || !selectedMarketCode ? "서울 공식 평균" : `서울 평균보다 ${Math.abs(differenceFromSeoul)}% ${differenceFromSeoul >= 0 ? "높음" : "낮음"}`}</small></article>
          <article><span>공실률</span><strong>{formatMetric(findMetric(benchmark.metrics, "vacancy_rate"))}</strong><small>조사 표본 기준</small></article>
          <article><span>{form.areaM2.toLocaleString("ko-KR")}㎡ 면적 환산 참고액</span><strong>{officialAreaEstimate === null ? "면적 필요" : `${officialAreaEstimate.toLocaleString("ko-KR")}원`}</strong><small>공식 임대료 단가 × 입력 면적</small></article>
        </div>
        <div className="rent-market-compare">
          <div><h3>{selectedMarketName || "서울 전체"} 공식 통계</h3><dl>{benchmark.metrics.map((metric) => <div key={metric.metric_key}><dt>{metric.label}</dt><dd>{formatMetric(metric)}</dd></div>)}</dl></div>
          <div><h3>서울 전체 평균</h3><dl>{benchmark.seoul_metrics.map((metric) => <div key={metric.metric_key}><dt>{metric.label}</dt><dd>{formatMetric(metric)}</dd></div>)}</dl></div>
          <div className="rent-market-limit"><h3>이 통계에서 알 수 없는 것</h3><p>평균 보증금, 권리금, 관리비, 층·도로 위치에 따른 차이는 제공하지 않습니다. 아래 실제 매물 조건과 현장 확인이 필요합니다.</p></div>
        </div>
        <p className="rent-market-notice">{benchmark.message} {benchmark.disclaimer}</p>
      </> : <p>공식 임대 통계를 불러오고 있습니다.</p>}
    </section>

    <section className="rent-layout">
      <div className="rent-form"><div className="section-heading"><div><p className="eyebrow">직접 찾은 매물</p><h2>실제 매물 조건 넣기</h2></div><p>금액 단위는 만원입니다.</p></div>
        <div className="rent-fields">
          <label><span>매물에 적힌 보증금</span><div><input type="number" min="0" value={form.deposit} onChange={(event) => update("deposit", event.target.value)} /><b>만원</b></div></label>
          <label><span>매물에 적힌 월세</span><div><input type="number" min="0" value={form.monthlyRent} onChange={(event) => update("monthlyRent", event.target.value)} /><b>만원/월</b></div></label>
          <label><span>관리비</span><div><input type="number" min="0" value={form.managementFee} onChange={(event) => update("managementFee", event.target.value)} /><b>만원/월</b></div></label>
          <label><span>전용·사용 면적</span><div><input type="number" min="0" value={form.areaM2} onChange={(event) => update("areaM2", event.target.value)} /><b>㎡</b></div></label>
          <label><span>예상 월매출</span><div><input type="number" min="0" value={form.expectedMonthlySales} onChange={(event) => update("expectedMonthlySales", event.target.value)} /><b>만원/월</b></div></label>
        </div>
        <p className="rent-form__note">보증금은 처음 필요한 자금으로만 표시하며 월 고정비에 더하지 않습니다. 권리금, 공사비, 인건비, 공과금은 별도로 확인해야 합니다.</p>
      </div>
      <aside className="rent-result"><p className="eyebrow">비용 요약</p><h2>이 매물의 월 공간비</h2><strong>{result.monthlyOccupancyCost.toLocaleString("ko-KR")}원</strong><dl><div><dt>연간 월세+관리비</dt><dd>{result.annualOccupancyCost.toLocaleString("ko-KR")}원</dd></div><div><dt>약 1평당 월 비용</dt><dd>{result.monthlyCostPerPyeong === null ? "면적 필요" : `${result.monthlyCostPerPyeong.toLocaleString("ko-KR")}원`}</dd></div><div><dt>예상매출 대비 공간비</dt><dd>{result.occupancyCostRatio === null ? "예상매출 필요" : `${result.occupancyCostRatio}%`}</dd></div><div><dt>별도 초기 보증금</dt><dd>{(form.deposit * 10_000).toLocaleString("ko-KR")}원</dd></div></dl><p>매출 대비 비율은 입력값을 사용한 단순 계산이며 적정성 판단이나 수익 보장이 아닙니다.</p></aside>
    </section>

    <section className="rent-sources">
      <div><p className="eyebrow">데이터 출처</p><h2>공식 임대 통계</h2><span className="source-status">R-ONE 분기 표본통계</span><p>소규모상가는 일반건축물대장상 상가 용도이면서 2층 이하, 연면적 330㎡ 이하인 건물을 조사합니다. 개별 매물 가격이 아니라 시장의 방향과 지역 차이를 확인하는 자료입니다.</p><a href={benchmark?.source_url} target="_blank" rel="noreferrer">한국부동산원 원문 통계 보기 →</a></div>
      <div><p className="eyebrow">실시간 매물</p><h2>최신 개별 매물</h2><span className="source-status source-status--muted">정식 매물 API 확인 중</span><p>공개 매물 API가 확인되지 않아 매물을 복제하거나 화면을 크롤링하지 않습니다. 최신 보증금·월세·권리금은 부동산 사이트나 공인중개사에서 확인한 뒤 위 계산기에 입력해 주세요.</p><a href="https://new.land.naver.com/" target="_blank" rel="noreferrer">네이버 부동산에서 직접 확인 →</a></div>
    </section>
    <section className="pipeline-next"><div><p className="eyebrow">다음 단계</p><h2>상권과 비용을 봤다면<br />확인할 지원·자금 후보를 살펴보세요.</h2></div><a href={`#funding?code=${code}`}>지원·자금 후보 확인 →</a></section>
  </main>;
}
