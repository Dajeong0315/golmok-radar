const KEY = "golmok-radar:industry:v1";
const DEFAULT = "CS100010";

export function initialIndustry(hash = window.location.hash): string {
  const fromUrl = new URLSearchParams(hash.split("?")[1] || "").get("industry");
  const selected = fromUrl || localStorage.getItem(KEY) || DEFAULT;
  return /^CS\d{6}$/.test(selected) ? selected : DEFAULT;
}

export function rememberIndustry(code: string): void {
  if (/^CS\d{6}$/.test(code)) localStorage.setItem(KEY, code);
}
