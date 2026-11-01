import { useEffect, useMemo, useState } from "react";

import { fetchRentBenchmark } from "./api";
import { calculateRent, roundBenchmarkValue } from "./rentCalculator";
import type { RentBenchmarkResponse } from "./types";

export function RentPage({ code }: { code: string }) {
  const [benchmark, setBenchmark] = useState<RentBenchmarkResponse | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ deposit: 3000, monthlyRent: 200, managementFee: 30, areaM2: 33, expectedMonthlySales: 2000 });

  useEffect(() => {
    if (!code) return;
    const controller = new AbortController();
    fetchRentBenchmark(code, controller.signal).then(setBenchmark).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, [code]);

  const result = useMemo(() => calculateRent({
    deposit: form.deposit * 10_000,
    monthlyRent: form.monthlyRent * 10_000,
    managementFee: form.managementFee * 10_000,
    areaM2: form.areaM2,
    expectedMonthlySales: form.expectedMonthlySales * 10_000,
  }), [form]);

  if (!code) return <main className="compare-state"><span className="state-mark">!</span><h1>상권을 먼저 선택해 주세요.</h1><a href="#recommendations">후보 상권 보기</a></main>;

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: Math.max(0, Number(value) || 0) }));

  return <main className="rent-page">
    <header className="site-header recommendation-header"><a className="brand" href="#top"><span className="brand-mark">G</span><span>골목 레이더</span></a><a className="back-link" href="#recommendations">← 후보 상권으로</a></header>
    <section className="rent-hero"><p className="eyebrow">임대 비용 확인</p><h1>{benchmark?.trade_area.name || "후보 상권"}의 임대 비용을<br />하나씩 확인하세요.</h1><p>지역 통계와 실제 매물 가격은 서로 달라요.<br />보고 있는 매물의 보증금, 월세, 관리비를 직접 넣어 한 달 고정비를 계산할 수 있어요.</p></section>
    {error ? <p className="error-banner">{error}</p> : null}
    <section className="rent-layout">
      <div className="rent-form"><div className="section-heading"><div><p className="eyebrow">YOUR LISTING</p><h2>매물 조건 입력</h2></div><p>금액 단위는 만원입니다.</p></div>
        <div className="rent-fields">
          <label><span>보증금</span><div><input type="number" min="0" value={form.deposit} onChange={(event) => update("deposit", event.target.value)} /><b>만원</b></div></label>
          <label><span>월세</span><div><input type="number" min="0" value={form.monthlyRent} onChange={(event) => update("monthlyRent", event.target.value)} /><b>만원/월</b></div></label>
          <label><span>관리비</span><div><input type="number" min="0" value={form.managementFee} onChange={(event) => update("managementFee", event.target.value)} /><b>만원/월</b></div></label>
          <label><span>전용·사용 면적</span><div><input type="number" min="0" value={form.areaM2} onChange={(event) => update("areaM2", event.target.value)} /><b>㎡</b></div></label>
          <label><span>예상 월매출</span><div><input type="number" min="0" value={form.expectedMonthlySales} onChange={(event) => update("expectedMonthlySales", event.target.value)} /><b>만원/월</b></div></label>
        </div>
        <p className="rent-form__note">보증금은 초기 필요 자금으로만 표시하며 월 고정비에 더하지 않습니다. 권리금, 공사비, 인건비, 공과금은 별도로 확인해야 합니다.</p>
      </div>
      <aside className="rent-result"><p className="eyebrow">COST SNAPSHOT</p><h2>월 공간 고정비</h2><strong>{result.monthlyOccupancyCost.toLocaleString("ko-KR")}원</strong><dl><div><dt>연간 월세+관리비</dt><dd>{result.annualOccupancyCost.toLocaleString("ko-KR")}원</dd></div><div><dt>약 1평당 월 비용</dt><dd>{result.monthlyCostPerPyeong === null ? "면적 필요" : `${result.monthlyCostPerPyeong.toLocaleString("ko-KR")}원`}</dd></div><div><dt>예상매출 대비 공간비</dt><dd>{result.occupancyCostRatio === null ? "예상매출 필요" : `${result.occupancyCostRatio}%`}</dd></div><div><dt>별도 초기 보증금</dt><dd>{(form.deposit * 10_000).toLocaleString("ko-KR")}원</dd></div></dl><p>매출 대비 비율은 사용자가 입력한 예상매출을 사용한 단순 계산이며 적정성 판단이나 수익 보장이 아닙니다.</p></aside>
    </section>
    <section className="rent-sources">
      <div><p className="eyebrow">OFFICIAL BENCHMARK</p><h2>공식 임대 통계</h2>{benchmark ? <><span className="source-status">{benchmark.status === "available" ? "서울 참고 벤치마크" : "원천 통계 준비 중"}</span><p>{benchmark.message}</p>{benchmark.metrics.length ? <dl>{benchmark.metrics.map((metric) => <div key={metric.metric_key}><dt>{metric.label}</dt><dd>{roundBenchmarkValue(metric.value).toLocaleString("ko-KR")} {metric.unit}</dd></div>)}</dl> : null}<dl><div><dt>공간 범위</dt><dd>{benchmark.source_region || "비교 불가"}</dd></div><div><dt>기준기간</dt><dd>{benchmark.source_period || "비교 불가"}</dd></div><div><dt>건물유형</dt><dd>{benchmark.building_type || "비교 불가"}</dd></div><div><dt>갱신주기</dt><dd>{benchmark.update_cycle}</dd></div><div><dt>실시간 매물 여부</dt><dd>{benchmark.is_live_listing ? "예" : "아니오"}</dd></div></dl><p>{benchmark.disclaimer}</p><a href={benchmark.source_url} target="_blank" rel="noreferrer">한국부동산원 원문 통계 보기 →</a></> : <p>공식 통계 연결 상태를 확인하고 있습니다.</p>}</div>
      <div><p className="eyebrow">LIVE LISTINGS</p><h2>개별 실매물</h2><span className="source-status source-status--muted">제휴 API 없음</span><p>네이버 부동산의 공개 매물 API가 확인되지 않아 매물을 복제하거나 크롤링하지 않습니다. 아래 링크에서 최신 매물과 중개사 정보를 직접 확인하고 조건을 위 계산기에 입력해 주세요.</p><a href="https://new.land.naver.com/" target="_blank" rel="noreferrer">네이버 부동산에서 직접 확인 →</a></div>
    </section>
    <section className="pipeline-next"><div><p className="eyebrow">다음 단계</p><h2>상권과 비용을 봤다면<br />확인할 지원·자금 후보를 살펴보세요.</h2></div><a href={`#funding?code=${code}`}>지원·자금 후보 확인 →</a></section>
  </main>;
}
