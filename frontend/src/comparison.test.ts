import { describe, expect, it } from "vitest";

import { formatMetricValue, parseComparisonCodes } from "./comparison";

describe("comparison helpers", () => {
  it("parses unique comparison codes and keeps at most four", () => {
    expect(parseComparisonCodes("#compare?codes=a,b,a,c,d,e")).toEqual(["a", "b", "c", "d"]);
  });

  it("formats units and unavailable values", () => {
    expect(formatMetricValue(1234567, "원")).toBe("1,234,567 원");
    expect(formatMetricValue(12.345, "%")).toBe("12.35%");
    expect(formatMetricValue(null, "개")).toBe("비교 불가");
  });
});
