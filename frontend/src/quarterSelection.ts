import { useEffect, useState } from "react";

import { fetchQuarters } from "./api";
import type { QuarterListResponse } from "./types";

// 기준분기는 URL로만 고정합니다. 저장해 두면 새 분기가 적재된 뒤에도 옛 분기에 머물 수 있어,
// URL에 분기가 없으면 서버가 정한 기본 분기(적재된 가장 최근 분기)를 씁니다.
export function isQuarterCode(value: string): boolean {
  return /^\d{4}[1-4]$/.test(value);
}

export function quarterFromHash(hash = window.location.hash): string {
  const value = new URLSearchParams(hash.split("?")[1] || "").get("quarter") || "";
  return isQuarterCode(value) ? value : "";
}

export function quarterLabel(code: string): string {
  return isQuarterCode(code) ? `${code.slice(0, 4)}년 ${code.slice(4)}분기` : "최신 공개 분기";
}

export function resolveSelectedQuarter(selected: string, list: QuarterListResponse | null): string {
  if (!list) return selected;
  return list.quarters.some((item) => item.code === selected) ? selected : list.default_quarter;
}

export function useQuarters(): { data: QuarterListResponse | null; error: string } {
  const [data, setData] = useState<QuarterListResponse | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetchQuarters(controller.signal).then(setData).catch((reason: Error) => {
      if (reason.name !== "AbortError") setError(reason.message);
    });
    return () => controller.abort();
  }, []);
  return { data, error };
}
