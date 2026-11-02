export type RentInputs = {
  deposit: number;
  monthlyRent: number;
  managementFee: number;
  areaM2: number;
  expectedMonthlySales: number;
};

export type RentResult = {
  monthlyOccupancyCost: number;
  annualOccupancyCost: number;
  monthlyCostPerPyeong: number | null;
  occupancyCostRatio: number | null;
};

export function calculateRent(inputs: RentInputs): RentResult {
  const monthlyOccupancyCost = Math.max(0, inputs.monthlyRent) + Math.max(0, inputs.managementFee);
  return {
    monthlyOccupancyCost,
    annualOccupancyCost: monthlyOccupancyCost * 12,
    monthlyCostPerPyeong: inputs.areaM2 > 0 ? Math.round(monthlyOccupancyCost / (inputs.areaM2 / 3.3058)) : null,
    occupancyCostRatio: inputs.expectedMonthlySales > 0 ? Math.round((monthlyOccupancyCost / inputs.expectedMonthlySales) * 1000) / 10 : null,
  };
}

export function parseRentAreaCode(hash: string): string {
  return new URLSearchParams(hash.split("?")[1] || "").get("code") || "";
}

export function roundBenchmarkValue(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function estimateRentFromOfficialRate(rateThousandPerM2: number | null, areaM2: number): number | null {
  if (rateThousandPerM2 === null || rateThousandPerM2 < 0 || areaM2 <= 0) return null;
  return Math.round(rateThousandPerM2 * 1_000 * areaM2);
}

export function compareWithSeoul(value: number | null, seoulValue: number | null): number | null {
  if (value === null || seoulValue === null || seoulValue === 0) return null;
  return Math.round(((value - seoulValue) / seoulValue) * 1_000) / 10;
}
