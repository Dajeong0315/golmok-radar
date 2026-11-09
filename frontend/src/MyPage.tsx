import { useEffect, useRef, useState } from "react";

import { fetchTradeAreas } from "./api";
import { fetchAccountFavorites, fetchAccountRecords, fetchAccountWorksheets, profileFromAccountRecord, removeAccountRecord, saveAccountRecord, saveAccountWorksheet, type AccountRecord } from "./accountStore";
import { initialIndustry } from "./industrySelection";
import { useAuth } from "./auth";
import { forgetProfile } from "./founderProfile";
import { TopNavigation } from "./TopNavigation";
import { AccountManagement } from "./AccountManagement";
import type { AreaReviewReport, CapturedReviewReport } from "./types";
import type { PropertyWorksheet } from "./propertyWorksheet";

export function MyPage() {
  const { client, configured, loading, user, signInWithKakao } = useAuth();
  const [records, setRecords] = useState<AccountRecord[]>([]);
  const [worksheets, setWorksheets] = useState<PropertyWorksheet[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [areaNames, setAreaNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const currentUserId = useRef(user?.id);
  currentUserId.current = user?.id;

  const reload = () => {
    if (!client || !user) return;
    const userId = user.id;
    const version = ++requestVersion.current;
    setLoadedUserId(null);
    setMessage("기록을 불러오는 중입니다.");
    Promise.all([fetchAccountRecords(client, userId), fetchAccountWorksheets(client, userId), fetchAccountFavorites(client, userId)])
      .then(([nextRecords, nextWorksheets, nextFavorites]) => {
        if (version !== requestVersion.current || currentUserId.current !== userId) return;
        setRecords(nextRecords);
        setWorksheets(nextWorksheets);
        setFavorites(nextFavorites);
        setLoadedUserId(userId);
        setMessage("");
      })
      .catch((error: Error) => {
        if (version === requestVersion.current && currentUserId.current === userId) setMessage(`기록을 불러오지 못했습니다: ${error.message}`);
      });
  };

  useEffect(() => {
    reload();
    return () => { requestVersion.current += 1; };
  }, [client, user?.id]);
  useEffect(() => {
    if (!favorites.length) return;
    const controller = new AbortController();
    void fetchTradeAreas("CS100010", controller.signal)
      .then((areas) => setAreaNames(Object.fromEntries(areas.map((area) => [area.code, area.name]))))
      .catch(() => setAreaNames({}));
    return () => controller.abort();
  }, [favorites.join(",")]);

  if (loading) return <main className="mypage-state">계정 정보를 확인하는 중입니다.</main>;
  if (!configured || !user) return <main className="mypage-state"><header className="site-header"><a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation /></header><section><p className="eyebrow">내 기록</p><h1>내 기록은 로그인 후에<br />안전하게 관리할 수 있어요.</h1><p>테스트 결과, 관심 상권, 매물 워크시트는 카카오 로그인 후 내 계정에서만 확인합니다.</p>{configured ? <button className="primary-action" onClick={() => void signInWithKakao()}>카카오로 로그인하기</button> : <p>현재 로그인 설정을 준비 중입니다.</p>}</section></main>;

  const renameRecord = async (record: AccountRecord) => {
    const title = window.prompt("기록 이름", record.title)?.trim();
    if (!title || !client) return;
    try {
      await saveAccountRecord(client, user.id, { ...record, title, updatedAt: new Date().toISOString() });
      reload();
    } catch (reason) {
      if (currentUserId.current === user.id) setMessage(`이름을 변경하지 못했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
    }
  };
  const deleteRecord = async (record: AccountRecord) => {
    if (!client || !window.confirm(`‘${record.title}’ 기록을 삭제할까요?`)) return;
    try {
      await removeAccountRecord(client, user.id, record.recordId);
      const deletedProfile = profileFromAccountRecord(record);
      if (deletedProfile) forgetProfile(localStorage, deletedProfile, user.id);
      reload();
    } catch (reason) {
      if (currentUserId.current === user.id) setMessage(`기록을 삭제하지 못했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
    }
  };
  const renameWorksheet = async (worksheet: PropertyWorksheet) => {
    const alias = window.prompt("매물 기록 이름", worksheet.alias)?.trim();
    if (alias === undefined || !client) return;
    try {
      await saveAccountWorksheet(client, user.id, { ...worksheet, alias, updatedAt: new Date().toISOString() });
      reload();
    } catch (reason) {
      if (currentUserId.current === user.id) setMessage(`매물 이름을 변경하지 못했습니다: ${reason instanceof Error ? reason.message : "다시 시도해 주세요."}`);
    }
  };

  const profileRecords = (loadedUserId === user.id ? records : []).filter((record) => record.kind === "founder_profile");
  const reviewRecords = (loadedUserId === user.id ? records : []).filter((record) => record.kind === "review_report");
  const areaReviewRecords = (loadedUserId === user.id ? records : []).filter((record) => record.kind === "area_review_report");
  const visibleFavorites = loadedUserId === user.id ? favorites : [];
  const visibleWorksheets = loadedUserId === user.id ? worksheets : [];
  return <main className="mypage">
    <header className="site-header"><a className="brand" href="#home"><span className="brand-mark">G</span><span>골목 레이더</span></a><TopNavigation /></header>
    <section className="mypage-hero"><p className="eyebrow">내 기록</p><h1>{user.user_metadata?.nickname || "나"}의 준비 기록</h1><p>저장한 시점의 결과와 입력값을 관리할 수 있어요.</p><div><a href="#explore">상권 탐색하기</a></div></section>
    {message ? <p className="selection-notice">{message}</p> : null}
    <section className="mypage-section"><div className="section-heading"><div><p className="eyebrow">테스트 결과</p><h2>내 창업 조건</h2></div><a className="primary-action mypage-retest" href="#quiz?restart=1">테스트 다시 해보기</a></div>{profileRecords.length ? <div className="mypage-grid">{profileRecords.map((record) => <article key={record.recordId}><small>{new Date(record.updatedAt).toLocaleDateString("ko-KR")}</small><a className="mypage-card-title" href={`#quiz?record=${encodeURIComponent(record.recordId)}`}>{record.title}</a><div className="mypage-card-actions"><button onClick={() => void renameRecord(record)}>이름 변경</button><button onClick={() => void deleteRecord(record)}>삭제</button></div></article>)}</div> : <p className="empty-favorites">아직 계정에 저장된 테스트 결과가 없습니다. 로그인 전 결과는 다음 로그인 때 자동 저장됩니다.</p>}</section>
    <section className="mypage-section"><div className="section-heading"><div><p className="eyebrow">개업 후 점검</p><h2>리뷰 비교 기록</h2></div><a href="#reviews">리뷰 비교하기</a></div>{reviewRecords.length ? <div className="mypage-grid">{reviewRecords.map((record) => { const report = record.payload as Partial<CapturedReviewReport> | null; return <article key={record.recordId}><small>{new Date(record.updatedAt).toLocaleDateString("ko-KR")}</small><a className="mypage-card-title" href={`#reviews?record=${encodeURIComponent(record.recordId)}`}>{record.title}</a><p>{report?.status === "available" ? "전체 표본 비교" : report?.status === "limited" ? "제한 표본 비교" : "표본 부족"} · {typeof report?.total_review_count === "number" ? `${report.total_review_count}건` : "건수 미확인"}</p><div className="mypage-card-actions"><a href={`#reviews?record=${encodeURIComponent(record.recordId)}`}>내용 보기</a><button onClick={() => void deleteRecord(record)}>삭제</button></div></article>; })}</div> : <p className="empty-favorites">저장된 리뷰 비교 기록이 없습니다.</p>}</section>
    <section className="mypage-section"><div className="section-heading"><div><p className="eyebrow">창업 전 상권 살펴보기</p><h2>상권 리뷰 표본 기록</h2></div><a href="#reviews">다른 상권 보기</a></div>{areaReviewRecords.length ? <div className="mypage-grid">{areaReviewRecords.map((record) => { const report = record.payload as Partial<AreaReviewReport> | null; return <article key={record.recordId}><small>{new Date(record.updatedAt).toLocaleDateString("ko-KR")}</small><a className="mypage-card-title" href={`#reviews?area_record=${encodeURIComponent(record.recordId)}`}>{record.title}</a><p>{report?.status === "available" ? "전체 표본" : report?.status === "limited" ? "제한 표본" : "표본 부족"} · {typeof report?.total_review_count === "number" ? `${report.total_review_count}건` : "건수 미확인"}</p><div className="mypage-card-actions"><a href={`#reviews?area_record=${encodeURIComponent(record.recordId)}`}>내용 보기</a><button onClick={() => void deleteRecord(record)}>삭제</button></div></article>; })}</div> : <p className="empty-favorites">저장된 상권 리뷰 표본이 없습니다.</p>}</section>
    <section className="mypage-section"><div className="section-heading"><div><p className="eyebrow">관심 상권 모음</p><h2>관심 상권 모음</h2></div><a href={`#explore?industry=${initialIndustry()}`}>상권 더 찾기</a></div>{visibleFavorites.length ? <div className="mypage-grid">{visibleFavorites.map((code) => <a className="mypage-card-link" key={code} href={`#explore?focus=${encodeURIComponent(code)}&industry=${initialIndustry()}`}><small>공식 상권 · {initialIndustry()} 기준으로 열기</small><strong>{areaNames[code] || "상권 정보 불러오는 중"}</strong><span>{areaNames[code] ? "상권 정보 보기 →" : code}</span></a>)}</div> : <p className="empty-favorites">저장한 상권이 없습니다.</p>}</section>
    <section className="mypage-section"><div className="section-heading"><div><p className="eyebrow">매물 워크시트</p><h2>매물 워크시트</h2></div><a href="#worksheet">매물 기록하기</a></div>{visibleWorksheets.length ? <div className="mypage-grid">{visibleWorksheets.map((worksheet) => <article key={worksheet.id}><small>마지막 수정 {new Date(worksheet.updatedAt).toLocaleDateString("ko-KR")}</small><a className="mypage-card-title" href={`#worksheet?id=${encodeURIComponent(worksheet.id)}`}>{worksheet.alias || "이름 없는 매물 후보"}</a><div className="mypage-card-actions"><button onClick={() => void renameWorksheet(worksheet)}>이름 변경</button><a href={`#worksheet?id=${encodeURIComponent(worksheet.id)}`}>내용 보기</a></div></article>)}</div> : <p className="empty-favorites">저장한 매물 워크시트가 없습니다.</p>}</section>
    <AccountManagement />
  </main>;
}
