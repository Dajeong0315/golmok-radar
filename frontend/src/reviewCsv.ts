export type ReviewCsvData = {
  own: string[];
  nearby: string[];
};

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("CSV의 따옴표가 닫히지 않았습니다.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parseReviewCsv(text: string): ReviewCsvData {
  const rows = csvRows(text);
  if (rows.length < 2) throw new Error("CSV에는 머리글과 리뷰 행이 필요합니다.");
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const groupIndex = header.indexOf("group");
  const reviewIndex = header.indexOf("review");
  if (groupIndex < 0 || reviewIndex < 0) throw new Error("CSV 머리글에는 group, review 열이 필요합니다.");

  const result: ReviewCsvData = { own: [], nearby: [] };
  rows.slice(1).forEach((values, offset) => {
    const group = (values[groupIndex] || "").trim().toLowerCase();
    const review = (values[reviewIndex] || "").trim();
    if (!review) return;
    if (["own", "own_shop", "내 가게", "내가게"].includes(group)) result.own.push(review);
    else if (["nearby", "comparison", "주변", "비교군"].includes(group)) result.nearby.push(review);
    else throw new Error(`CSV ${offset + 2}행의 group은 own 또는 nearby여야 합니다.`);
  });
  if (!result.own.length || !result.nearby.length) throw new Error("own과 nearby 리뷰가 각각 한 건 이상 필요합니다.");
  if (result.own.length > 500 || result.nearby.length > 500) throw new Error("각 그룹은 최대 500건까지 가져올 수 있습니다.");
  return result;
}
