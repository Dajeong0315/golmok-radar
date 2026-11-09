type NavigationKey = "workflow" | "explore" | "quiz" | "worksheet" | "funding" | "reviews";

import { useAuth } from "./auth";

const navigationItems: Array<{ key: NavigationKey; label: string; href: string }> = [
  { key: "workflow", label: "서비스 소개", href: "#home" },
  { key: "explore", label: "상권 탐색", href: "#explore" },
  { key: "quiz", label: "조건 정리", href: "#quiz" },
  { key: "worksheet", label: "매물 검증", href: "#worksheet" },
  { key: "funding", label: "공식 정보", href: "#funding" },
  { key: "reviews", label: "운영 개선", href: "#reviews" },
];

export function TopNavigation({ active }: { active?: NavigationKey }) {
  const { configured, error, loading, user, signInWithKakao, signOut, transferStatus, retryTransfer } = useAuth();
  return <nav className="top-navigation" aria-label="골목 레이더 기능 탐색">
    {navigationItems.slice(0, 2).map((item) => <a aria-current={item.key === active ? "page" : undefined} className={item.key === active ? "active" : ""} href={item.href} key={item.key}>{item.label}</a>)}
    <a href="#mypage">내 기록</a>
    {active !== "workflow" ? <details className="tools-menu" key={active}>
      <summary>창업 도구</summary>
      <div>{navigationItems.slice(2).map((item) => <a key={item.key} href={item.href} aria-current={item.key === active ? "page" : undefined}>{item.label}</a>)}</div>
    </details> : null}
    {configured ? <span className="account-control">
      {user ? <><span className="account-control__status">{transferStatus === "saving" ? "기록 저장 중" : transferStatus === "failed" ? "기록 저장 실패" : transferStatus === "complete" ? "기록 저장 완료" : "카카오 로그인됨"}</span>{transferStatus === "failed" ? <button onClick={() => void retryTransfer()}>다시 저장</button> : null}<button onClick={() => void signOut()}>로그아웃</button></> : <span><button disabled={loading} onClick={() => void signInWithKakao()}>카카오로 저장하기</button><small className="account-control__hint">남아 있는 이용 기록을 이 계정에 저장합니다.</small></span>}
      {error ? <small className="account-control__error" role="alert">로그인 오류: {error}</small> : null}
    </span> : null}
  </nav>;
}
