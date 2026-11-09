import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { fetchAccountWorksheets, mergeWorksheets, removeAccountWorksheet, saveAccountWorksheet } from "./accountStore";
import { useAuth } from "./auth";
import { mayImportLocalData, mayReadLocalData } from "./favorites";
import { calculatePropertyWorksheet, CHECK_ITEMS, createWorksheet, loadPropertyWorksheets, savePropertyWorksheets, type AreaUnit, type CheckStatus, type PropertyWorksheet, type VatStatus } from "./propertyWorksheet";
import { TopNavigation } from "./TopNavigation";
import { registerAnonymousRecord } from "./anonymousSession";

const statusLabels: Record<CheckStatus, string> = { confirmed: "확인 완료", needs_follow_up: "추가 확인", not_applicable: "해당 없음", not_recorded: "기록 없음" };
const vatLabels: Record<VatStatus, string> = { included: "포함", separate: "별도", needs_confirmation: "확인 필요" };
const observationLabels = { weekday: "평일", weekend: "주말", morning: "오전", lunch: "점심", evening: "저녁" };

function numberValue(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function PropertyWorksheetPage() {
  const { client, user } = useAuth();
  const requestedWorksheetId = new URLSearchParams(window.location.hash.split("?", 2)[1] || "").get("id");
  const [worksheets, setWorksheets] = useState<PropertyWorksheet[]>(() => loadPropertyWorksheets(localStorage, user?.id ?? null));
  const [activeId, setActiveId] = useState<string>(() => worksheets[0]?.id || "");
  const [syncMessage, setSyncMessage] = useState("");
  const initializedUser = useRef<string | null>(null);

  useEffect(() => {
    if (!user && !mayReadLocalData(localStorage, null)) {
      setWorksheets([]);
      setActiveId("");
      setSyncMessage("");
    }
  }, [user?.id]);

  useEffect(() => {
    if (!client || !user) {
      initializedUser.current = null;
      return;
    }
    let activeRequest = true;
    void fetchAccountWorksheets(client, user.id).then(async (remote) => {
      if (!activeRequest) return;
      const local = mayImportLocalData(localStorage, user.id) ? worksheets : [];
      const merged = mergeWorksheets(local, remote);
      setWorksheets(merged);
      setActiveId((current) => requestedWorksheetId && merged.some((item) => item.id === requestedWorksheetId) ? requestedWorksheetId : current && merged.some((item) => item.id === current) ? current : merged[0]?.id || "");
      initializedUser.current = user.id;
    }).catch((reason: Error) => {
      if (activeRequest) setSyncMessage(`계정 동기화에 실패했습니다: ${reason.message}`);
    });
    return () => { activeRequest = false; };
  }, [client, requestedWorksheetId, user?.id]);

  const active = worksheets.find((item) => item.id === activeId) || null;
  const calculation = useMemo(() => active ? calculatePropertyWorksheet(active) : null, [active]);
  const addWorksheet = () => {
    const worksheet = createWorksheet();
    setWorksheets((current) => [...current, worksheet]);
    setActiveId(worksheet.id);
  };
  const update = (patch: Partial<PropertyWorksheet>) => {
    if (!active) return;
    setWorksheets((current) => current.map((item) => item.id === active.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  };
  const save = async () => {
    if (!worksheets.length) return;
    savePropertyWorksheets(localStorage, worksheets);
    if (!user) {
      registerAnonymousRecord(localStorage);
      setSyncMessage("이 브라우저에 매물 워크시트를 저장했습니다. 로그인하면 계정에도 보관할 수 있어요.");
      return;
    }
    if (!client || !active) return;
    setSyncMessage("저장 중입니다.");
    try {
      await saveAccountWorksheet(client, user.id, active);
      setSyncMessage("카카오 계정에 저장했습니다.");
    } catch (reason) {
      setSyncMessage(`계정 저장에 실패했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
    }
  };
  const remove = () => {
    if (!active) return;
    if (client && user) void removeAccountWorksheet(client, user.id, active.id).catch((reason: Error) => setSyncMessage(`계정 삭제 동기화에 실패했습니다: ${reason.message}`));
    const next = worksheets.filter((item) => item.id !== active.id);
    setWorksheets(next);
    savePropertyWorksheets(localStorage, next);
    setActiveId(worksheets.find((item) => item.id !== active.id)?.id || "");
  };

  return <main className="worksheet-page">
    <header className="site-header recommendation-header"><a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation active="worksheet" /><a className="back-link" href="#explore">상권 탐색</a></header>
    <section className="worksheet-hero"><p className="eyebrow">매물 검증</p><h1>통계 다음은,<br />직접 본 매물을 확인하세요.</h1><p>{user ? "직접 입력한 매물 기록을 카카오 계정과 이 브라우저에 저장합니다." : "직접 입력한 매물 기록은 현재 브라우저에 저장됩니다. 카카오 로그인 시 다른 기기에서도 복구할 수 있습니다."} 계약 여부나 영업 가능성을 판단하지 않습니다.</p>{syncMessage ? <p className="account-sync-message" role="status">{syncMessage}</p> : null}</section>

    <section className="worksheet-boundary" aria-label="데이터 구분"><article><strong>서울시 상권 통계</strong><span>상권 코드·기준분기·업종 기준</span></article><article><strong>R-ONE 임대 벤치마크</strong><span>공식 조사상권의 분기 표본 통계</span></article><article><strong>사용자 입력 매물</strong><span>입력일·확인 상태가 있는 개별 후보 기록</span></article></section>

    <section className="worksheet-shell">
      <aside className="worksheet-list"><div><p className="eyebrow">내 매물 후보</p><button className="worksheet-add" onClick={addWorksheet}>+ 매물 후보 추가</button></div>{worksheets.length ? <div className="worksheet-tabs">{worksheets.map((item, index) => <button className={item.id === activeId ? "active" : ""} key={item.id} onClick={() => setActiveId(item.id)}><small>후보 {index + 1}</small><strong>{item.alias || "별칭 입력 전"}</strong></button>)}</div> : <p className="worksheet-empty">아직 저장한 매물 후보가 없습니다. 직접 확인한 정보를 넣어 시작하세요.</p>}</aside>
      {!active || !calculation ? <section className="worksheet-empty-main"><h2>매물 후보를 추가해 주세요.</h2><p>주소 자동 조회나 외부 매물 수집 없이, 직접 확인한 정보만 기록합니다.</p><button className="primary-action" onClick={addWorksheet}>첫 매물 후보 추가 <span>→</span></button></section> : <WorksheetEditor worksheet={active} calculation={calculation} onUpdate={update} onRemove={remove} onSave={() => void save()} />}
    </section>
  </main>;
}

function WorksheetEditor({ worksheet, calculation, onUpdate, onRemove, onSave }: { worksheet: PropertyWorksheet; calculation: ReturnType<typeof calculatePropertyWorksheet>; onUpdate: (patch: Partial<PropertyWorksheet>) => void; onRemove: () => void; onSave: () => void }) {
  const updateMoney = (key: "depositWon" | "monthlyRentWon" | "maintenanceFeeWon" | "premiumWon" | "brokerageFeeWon" | "initialCostWon" | "expectedMonthlySalesWon", value: string) => onUpdate({ [key]: numberValue(value) } as Partial<PropertyWorksheet>);
  const addObservation = () => onUpdate({ observations: [...worksheet.observations, { id: crypto.randomUUID(), date: "", dayType: "weekday", timeBand: "morning" }] });
  const updateObservation = (id: string, patch: Partial<PropertyWorksheet["observations"][number]>) => onUpdate({ observations: worksheet.observations.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const removeObservation = (id: string) => onUpdate({ observations: worksheet.observations.filter((item) => item.id !== id) });
  return <section className="worksheet-editor">
    <div className="worksheet-heading"><div><p className="eyebrow">직접 입력한 매물 정보</p><h2>{worksheet.alias || "새 매물 후보"}</h2><p>마지막 수정 {new Date(worksheet.updatedAt).toLocaleString("ko-KR")}</p></div><div className="worksheet-actions"><button className="worksheet-save" onClick={onSave}>저장하기</button><button className="worksheet-delete" onClick={onRemove}>이 후보 삭제</button></div></div>
    <div className="worksheet-form-grid">
      <Field label="매물 별칭"><input value={worksheet.alias} onChange={(event) => onUpdate({ alias: event.target.value })} placeholder="예: 성수 A 코너 1층" /></Field>
      <Field label="주소 또는 위치 설명"><input value={worksheet.locationDescription} onChange={(event) => onUpdate({ locationDescription: event.target.value })} placeholder="예: OO역 2번 출구 뒤편" /></Field>
      <Field label="층수"><input value={worksheet.floor} onChange={(event) => onUpdate({ floor: event.target.value })} placeholder="예: 1층" /></Field>
      <Field label="전용면적"><div className="input-pair"><input type="number" min="0.01" step="0.01" value={worksheet.exclusiveArea ?? ""} onChange={(event) => onUpdate({ exclusiveArea: Number(event.target.value) > 0 ? Number(event.target.value) : null })} placeholder="0" /><select value={worksheet.areaUnit} onChange={(event) => onUpdate({ areaUnit: event.target.value as AreaUnit })}><option value="sqm">㎡</option><option value="pyeong">평</option></select></div></Field>
      <MoneyField label="보증금" value={worksheet.depositWon} onChange={(value) => updateMoney("depositWon", value)} />
      <MoneyField label="월세" value={worksheet.monthlyRentWon} onChange={(value) => updateMoney("monthlyRentWon", value)} />
      <MoneyField label="관리비" value={worksheet.maintenanceFeeWon} onChange={(value) => updateMoney("maintenanceFeeWon", value)} hint="없음·미확인은 0으로 바꾸지 말고 확인 상태를 남겨 주세요." />
      <Field label="부가세"><select value={worksheet.vatStatus} onChange={(event) => onUpdate({ vatStatus: event.target.value as VatStatus })}>{Object.entries(vatLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
      <MoneyField label="권리금" value={worksheet.premiumWon} onChange={(value) => updateMoney("premiumWon", value)} />
      <MoneyField label="중개수수료" value={worksheet.brokerageFeeWon} onChange={(value) => updateMoney("brokerageFeeWon", value)} />
      <MoneyField label="인테리어·설비 등 초기 비용 추정치" value={worksheet.initialCostWon} onChange={(value) => updateMoney("initialCostWon", value)} />
      <MoneyField label="예상 월매출 (선택 입력)" value={worksheet.expectedMonthlySalesWon} onChange={(value) => updateMoney("expectedMonthlySalesWon", value)} />
    </div>
    <p className="worksheet-input-note">금액은 원 단위입니다. 예상 월매출은 서비스가 추정하지 않으며, 입력한 경우에만 단순 비율을 계산합니다.</p>
    <section className="worksheet-calculations"><div><p className="eyebrow">계산 근거</p><h2>입력값으로만 계산한 비용</h2></div><div className="worksheet-metric-grid"><Metric label="초기 투입비" detail="보증금 + 권리금 + 중개수수료 + 초기 비용" metric={calculation.initialInvestment} /><Metric label="월 공간비" detail="월세 + 관리비" metric={calculation.monthlySpaceCost} /><Metric label="면적당 월 공간비" detail="월 공간비 ÷ 전용면적 · 원/㎡" metric={calculation.monthlyCostPerSqm} suffix="원/㎡" /><Metric label="예상 월매출 대비 월 공간비" detail="월 공간비 ÷ 예상 월매출" metric={calculation.spaceCostToSalesRatio} suffix="%" /></div></section>
    <section className="worksheet-observations"><div className="worksheet-section-heading"><div><p className="eyebrow">현장 관찰 시점</p><h2>언제 직접 봤나요?</h2><p>평일·주말, 오전·점심·저녁 관찰을 구분해 남기세요.</p></div><button onClick={addObservation}>관찰 시점 추가</button></div>{worksheet.observations.length ? <div className="observation-list">{worksheet.observations.map((item) => <div key={item.id}><input type="date" aria-label="관찰 날짜" value={item.date} onChange={(event) => updateObservation(item.id, { date: event.target.value })} /><select aria-label="관찰 요일 유형" value={item.dayType} onChange={(event) => updateObservation(item.id, { dayType: event.target.value as "weekday" | "weekend" })}><option value="weekday">평일</option><option value="weekend">주말</option></select><select aria-label="관찰 시간대" value={item.timeBand} onChange={(event) => updateObservation(item.id, { timeBand: event.target.value as "morning" | "lunch" | "evening" })}><option value="morning">오전</option><option value="lunch">점심</option><option value="evening">저녁</option></select><span>{item.date ? `${observationLabels[item.dayType]} ${observationLabels[item.timeBand]}` : "날짜 입력 필요"}</span><button onClick={() => removeObservation(item.id)}>삭제</button></div>)}</div> : <p className="worksheet-empty">아직 기록한 관찰 시점이 없습니다.</p>}</section>
    <section className="worksheet-checks"><div><p className="eyebrow">현장·계약 전 확인</p><h2>판정 대신 확인 상태를 남기세요.</h2><p>건축물 용도, 영업 가능 여부, 특약, 원상복구는 공식 기관 또는 전문가 확인이 필요합니다.</p></div><div className="check-list">{CHECK_ITEMS.map((item) => <label key={item.key}><span><small>{item.category}</small><strong>{item.label}</strong>{item.category === "계약 전 확인" ? <em>공식 기관 또는 전문가 확인 필요</em> : null}</span><select value={worksheet.checks[item.key]} onChange={(event) => onUpdate({ checks: { ...worksheet.checks, [item.key]: event.target.value as CheckStatus } })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>)}</div></section>
    <section className="worksheet-next"><div><p className="eyebrow">다음: 의사결정 준비</p><h2>확인 상태를 남겼다면,<br />공식 정보도 확인하세요.</h2><p>지원·자금 정보는 공식 출처에서 조건과 확인일을 살펴보세요. 계약·인허가 항목은 서비스가 판정하지 않습니다.</p></div><a className="primary-action" href="#funding">공식 지원·자금 정보 보기 <span>→</span></a></section>
  </section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <label className="worksheet-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>; }
function MoneyField({ label, value, hint, onChange }: { label: string; value: number | null; hint?: string; onChange: (value: string) => void }) { return <Field label={label} hint={hint}><div className="money-input"><input type="number" min="0" step="1" value={value ?? ""} onChange={(event) => onChange(event.target.value)} placeholder="입력 필요" /><b>원</b></div></Field>; }
function Metric({ label, detail, metric, suffix }: { label: string; detail: string; metric: ReturnType<typeof calculatePropertyWorksheet>["initialInvestment"]; suffix?: string }) { return <article className={metric.status}><span>{label}</span><strong>{metric.status === "available" ? `${metric.value!.toLocaleString("ko-KR")}${suffix || "원"}` : metric.status === "input_required" ? "입력 필요" : "비교 불가"}</strong><small>{metric.status === "available" ? detail : metric.reason}</small></article>; }
