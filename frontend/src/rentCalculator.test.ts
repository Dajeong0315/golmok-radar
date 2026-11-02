import { describe, expect, it } from "vitest";

import { calculateRent, compareWithSeoul, estimateRentFromOfficialRate, parseRentAreaCode, roundBenchmarkValue } from "./rentCalculator";

describe("rent calculator", () => {
  it("separates deposit from recurring occupancy cost", () => {
    const result = calculateRent({ deposit: 30_000_000, monthlyRent: 2_000_000, managementFee: 300_000, areaM2: 33.058, expectedMonthlySales: 20_000_000 });
    expect(result.monthlyOccupancyCost).toBe(2_300_000);
    expect(result.annualOccupancyCost).toBe(27_600_000);
    expect(result.monthlyCostPerPyeong).toBe(230_000);
    expect(result.occupancyCostRatio).toBe(11.5);
  });

  it("does not divide by missing area or sales", () => {
    const result = calculateRent({ deposit: 0, monthlyRent: 1, managementFee: 0, areaM2: 0, expectedMonthlySales: 0 });
    expect(result.monthlyCostPerPyeong).toBeNull();
    expect(result.occupancyCostRatio).toBeNull();
  });

  it("parses the selected trade area", () => {
    expect(parseRentAreaCode("#rent?code=3110118")).toBe("3110118");
  });

  it("rounds official benchmark values to two decimal places for display", () => {
    expect(roundBenchmarkValue(53.081)).toBe(53.08);
    expect(roundBenchmarkValue(100.465)).toBe(100.47);
  });

  it("converts the official thousand-won per square-meter rate into an area reference amount", () => {
    expect(estimateRentFromOfficialRate(67.38, 33)).toBe(2_223_540);
    expect(estimateRentFromOfficialRate(67.38, 0)).toBeNull();
  });

  it("compares a selected official market with the Seoul benchmark", () => {
    expect(compareWithSeoul(67.38, 53.08)).toBe(26.9);
    expect(compareWithSeoul(10, 0)).toBeNull();
  });
});
