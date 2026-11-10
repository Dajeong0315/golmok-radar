/**
 * 인쇄 전에 리포트 글자의 웹 글꼴을 받아 둡니다.
 * Google Fonts의 한글 글꼴은 글자 묶음별 조각(unicode-range)으로 나뉘어, 화면에 보인 글자만 받습니다.
 * 인쇄본은 화면에서 숨겨져 있어 그 글자 조각이 없으면, 인쇄 창이 다른 글꼴로 대체해 한글이 섞이거나 깨집니다.
 */
export const PRINT_FONT_FACES = [
  '400 16px "IBM Plex Sans KR"',
  '600 16px "IBM Plex Sans KR"',
  '700 16px "IBM Plex Sans KR"',
  '16px "Black Han Sans"',
] as const;

export async function loadPrintFonts(text: string, fonts: Pick<FontFaceSet, "load" | "ready"> | undefined = document.fonts, timeoutMs = 6000): Promise<"loaded" | "timeout" | "unsupported"> {
  if (!fonts || !text.trim()) return "unsupported";
  const load = Promise.all(PRINT_FONT_FACES.map((face) => fonts.load(face, text))).then(() => fonts.ready).then(() => "loaded" as const);
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs));
  // 글꼴 서버가 막혀도 인쇄는 진행합니다(이때는 브라우저 기본 한글 글꼴로 인쇄됩니다).
  return Promise.race([load.catch(() => "timeout" as const), timeout]);
}
