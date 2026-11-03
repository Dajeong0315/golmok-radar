/** Keep existing exploration bookmarks working while the default entry becomes home. */
export function isExplorerHash(hash: string): boolean {
  return ["#explore", "#top", "#explorer-title", "#favorites-title"].includes(hash.split("?")[0]);
}

export function isQuizRestartHash(hash: string): boolean {
  if (!hash.startsWith("#quiz")) return false;
  const query = hash.split("?", 2)[1];
  return new URLSearchParams(query || "").get("restart") === "1";
}

export function quizRecordId(hash: string): string | null {
  if (!hash.startsWith("#quiz")) return null;
  const query = hash.split("?", 2)[1];
  const value = new URLSearchParams(query || "").get("record");
  return value && /^[\w:-]+$/.test(value) ? value : null;
}
