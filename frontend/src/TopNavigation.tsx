type NavigationKey = "workflow" | "explore" | "quiz" | "worksheet" | "funding" | "reviews";

const navigationItems: Array<{ key: NavigationKey; label: string; href: string }> = [
  { key: "workflow", label: "서비스 소개", href: "#home" },
  { key: "explore", label: "상권 탐색", href: "#explore" },
  { key: "quiz", label: "조건 정리", href: "#quiz" },
  { key: "worksheet", label: "매물 검증", href: "#worksheet" },
  { key: "funding", label: "공식 정보", href: "#funding" },
  { key: "reviews", label: "운영 개선", href: "#reviews" },
];

export function TopNavigation({ active }: { active?: NavigationKey }) {
  return <nav className="top-navigation" aria-label="골목 레이더 기능 탐색">
    {navigationItems.slice(0, 2).map((item) => <a aria-current={item.key === active ? "page" : undefined} className={item.key === active ? "active" : ""} href={item.href} key={item.key}>{item.label}</a>)}
    {active !== "workflow" ? <details className="tools-menu" key={active}>
      <summary>창업 도구</summary>
      <div>{navigationItems.slice(2).map((item) => <a key={item.key} href={item.href} aria-current={item.key === active ? "page" : undefined}>{item.label}</a>)}</div>
    </details> : null}
  </nav>;
}
