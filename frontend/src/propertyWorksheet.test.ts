import { describe, expect, it } from "vitest";

import { calculatePropertyWorksheet, createWorksheet, loadPropertyWorksheets, parsePropertyWorksheet, PROPERTY_WORKSHEETS_KEY, savePropertyWorksheets } from "./propertyWorksheet";

describe("property worksheet", () => {
  it("calculates costs with square-meter and pyeong inputs", () => {
    const worksheet = { ...createWorksheet("one"), exclusiveArea: 10, areaUnit: "pyeong" as const, depositWon: 30_000_000, monthlyRentWon: 2_000_000, maintenanceFeeWon: 300_000, premiumWon: 5_000_000, brokerageFeeWon: 1_000_000, initialCostWon: 12_000_000, expectedMonthlySalesWon: 20_000_000 };
    const result = calculatePropertyWorksheet(worksheet);
    expect(result.initialInvestment.value).toBe(48_000_000);
    expect(result.monthlySpaceCost.value).toBe(2_300_000);
    expect(result.monthlyCostPerSqm.value).toBe(69_575);
    expect(result.spaceCostToSalesRatio.value).toBe(11.5);
  });

  it("does not turn missing inputs or a zero sales denominator into zero", () => {
    const result = calculatePropertyWorksheet({ ...createWorksheet("two"), monthlyRentWon: 1_000_000, maintenanceFeeWon: null, expectedMonthlySalesWon: 0 });
    expect(result.initialInvestment).toMatchObject({ status: "input_required", value: null });
    expect(result.monthlySpaceCost).toMatchObject({ status: "input_required", value: null });
    expect(result.monthlyCostPerSqm).toMatchObject({ status: "input_required", value: null });
    expect(result.spaceCostToSalesRatio).toMatchObject({ status: "input_required", value: null });
  });

  it("returns unavailable for zero expected sales only after monthly costs are complete", () => {
    const result = calculatePropertyWorksheet({ ...createWorksheet("three"), monthlyRentWon: 1, maintenanceFeeWon: 0, expectedMonthlySalesWon: 0 });
    expect(result.spaceCostToSalesRatio).toMatchObject({ status: "unavailable", value: null });
  });

  it("filters malformed saved data and restores permitted check statuses", () => {
    const stored = JSON.stringify([{ ...createWorksheet("ok"), checks: { foot_traffic: "confirmed", lease_terms: "invalid" } }, { id: 3 }]);
    expect(loadPropertyWorksheets({ getItem: () => stored })).toMatchObject([{ id: "ok", checks: { foot_traffic: "confirmed", lease_terms: "not_recorded" } }]);
    expect(parsePropertyWorksheet({ id: "bad", exclusiveArea: 0 })).toMatchObject({ exclusiveArea: null });
  });

  it("saves only parseable worksheets under the versioned key", () => {
    const calls: Array<[string, string]> = [];
    savePropertyWorksheets({ setItem: (key, value) => calls.push([key, value]) }, [createWorksheet("saved")]);
    expect(calls[0][0]).toBe(PROPERTY_WORKSHEETS_KEY);
    expect(JSON.parse(calls[0][1])[0].id).toBe("saved");
  });
});
