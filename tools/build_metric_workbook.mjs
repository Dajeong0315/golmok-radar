import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";


const outputPath = "docs/지표_손계산_기준표.xlsx";
const previewPath = ".pytest-tmp/metric-workbook-preview.png";

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("계산 기준");
sheet.showGridLines = false;

sheet.getRange("A2:G2").merge();
sheet.getRange("A2").values = [["골목 레이더 지표 손계산 기준표"]];
sheet.getRange("A3:G3").merge();
sheet.getRange("A3").values = [["pytest 기대값과 대조하는 정상·경계·결측·극단 사례"]];

sheet.getRange("A5:G5").values = [[
  "유형", "지표", "분자", "분모", "엑셀 계산 결과", "pytest 기대값", "판정"
]];
sheet.getRange("A6:D13").values = [
  ["정상", "주말 매출 비중 (%)", 300, 1000],
  ["정상", "주중 매출 비중 (%)", 2, 3],
  ["경계", "시간대 유동인구 비중 (%)", 1, 8],
  ["경계", "주말 매출 비중 (%)", 0, 100],
  ["경계", "건당 평균 결제액 (원)", 105, 2],
  ["결측", "주말 매출 비중 (%)", 100, 0],
  ["결측", "주말 매출 비중 (%)", null, 100],
  ["극단", "건당 평균 결제액 (원)", 9999999999, 1],
];
sheet.getRange("F6:F13").values = [[30.0], [66.7], [12.5], [0.0], [53], ["비교 불가"], ["비교 불가"], [9999999999]];

for (const row of [6, 7, 8, 9]) {
  sheet.getRange(`E${row}`).formulas = [[`=IF(D${row}=0,"비교 불가",ROUND(C${row}/D${row}*100,1))`]];
}
sheet.getRange("E10").formulas = [["=IF(D10=0,\"비교 불가\",ROUND(C10/D10,0))"]];
sheet.getRange("E11").formulas = [["=IF(D11=0,\"비교 불가\",ROUND(C11/D11*100,1))"]];
sheet.getRange("E12").formulas = [["=IF(C12=\"\",\"비교 불가\",IF(D12=0,\"비교 불가\",ROUND(C12/D12*100,1)))"]];
sheet.getRange("E13").formulas = [["=IF(D13=0,\"비교 불가\",ROUND(C13/D13,0))"]];
for (let row = 6; row <= 13; row += 1) {
  sheet.getRange(`G${row}`).formulas = [[`=IF(E${row}=F${row},"일치","불일치")`]];
}

sheet.getRange("A15:G15").merge();
sheet.getRange("A15").values = [["계산 규칙"]];
sheet.getRange("A16:G19").values = [
  ["비율", "분자 ÷ 분모 × 100", "소수 첫째 자리", "ROUND_HALF_UP", null, null, null],
  ["건당 평균", "매출 금액 ÷ 매출 건수", "원 단위", "ROUND_HALF_UP", null, null, null],
  ["분모 0", "비교 불가", null, null, null, null, null],
  ["원천값 누락", "비교 불가", null, null, null, null, null],
];
sheet.getRange("A21:G21").merge();
sheet.getRange("A21").values = [["출처: docs/spec.md 6장 지표 계산 명세, 작성일 2026-10-29"]];

const used = sheet.getRange("A2:G21");
used.format.font = { name: "Arial", size: 10, color: "#1F2937" };
used.format.verticalAlignment = "center";
sheet.getRange("A2:G2").format.font = { name: "Arial", size: 15, bold: true, color: "#123047" };
sheet.getRange("A3:G3").format.font = { name: "Arial", size: 10, italic: true, color: "#5B6470" };
sheet.getRange("A5:G5").format = {
  fill: "#123047",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#123047" },
};
sheet.getRange("A6:G13").format.borders = {
  insideHorizontal: { style: "thin", color: "#D9E1E8" },
  bottom: { style: "thin", color: "#AEBBC6" },
};
sheet.getRange("A15:G15").format = {
  fill: "#DDEBF2",
  font: { name: "Arial", size: 10, bold: true, color: "#123047" },
  borders: { preset: "outside", style: "thin", color: "#A7BBC8" },
};
sheet.getRange("A16:D19").format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
};
sheet.getRange("C6:D13").format.numberFormat = "#,##0";
sheet.getRange("E6:F9").format.numberFormat = "#,##0.0";
sheet.getRange("E10:F13").format.numberFormat = "#,##0";
sheet.getRange("A6:A13").format.horizontalAlignment = "center";
sheet.getRange("C6:G13").format.horizontalAlignment = "right";
sheet.getRange("G6:G13").conditionalFormats.addCustom('=G6="불일치"', {
  fill: "#FDE8E8",
  font: { color: "#B91C1C", bold: true },
});
sheet.getRange("A21:G21").format.font = { name: "Arial", size: 9, italic: true, color: "#5B6470" };

sheet.getRange("A2:G21").format.autofitColumns();
sheet.getRange("A2:G21").format.autofitRows();
sheet.getRange("A:A").format.columnWidth = 12;
sheet.getRange("B:B").format.columnWidth = 30;
sheet.getRange("C:F").format.columnWidth = 17;
sheet.getRange("G:G").format.columnWidth = 12;
sheet.freezePanes.freezeRows(5);

workbook.recalculate();
const inspection = await workbook.inspect({
  kind: "table",
  range: "계산 기준!A5:G13",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 8,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 50 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir("docs", { recursive: true });
await fs.mkdir(".pytest-tmp", { recursive: true });
const preview = await workbook.render({ sheetName: "계산 기준", range: "A2:G21", scale: 1.5, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewPath }));

