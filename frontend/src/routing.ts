/** Keep existing exploration bookmarks working while the default entry becomes home. */
export function isExplorerHash(hash: string): boolean {
  return ["#explore", "#top", "#explorer-title", "#favorites-title"].includes(hash.split("?")[0]);
}
