import { describe, expect, it } from "vitest";

import { loadPrintFonts, PRINT_FONT_FACES } from "./printFonts";

describe("print fonts", () => {
  it("asks every report font face for the report's own characters before printing", async () => {
    const requested: Array<[string, string]> = [];
    const fonts = { load: async (face: string, text?: string) => { requested.push([face, text || ""]); return []; }, ready: Promise.resolve() } as never;
    await expect(loadPrintFonts("성수역 33.1%", fonts)).resolves.toBe("loaded");
    expect(requested.map(([face]) => face)).toEqual([...PRINT_FONT_FACES]);
    expect(new Set(requested.map(([, text]) => text))).toEqual(new Set(["성수역 33.1%"]));
  });

  it("still lets printing go ahead when fonts are slow or blocked", async () => {
    const never = { load: () => new Promise(() => undefined), ready: Promise.resolve() } as never;
    await expect(loadPrintFonts("성수역", never, 10)).resolves.toBe("timeout");
    const failing = { load: async () => { throw new Error("blocked"); }, ready: Promise.resolve() } as never;
    await expect(loadPrintFonts("성수역", failing, 1000)).resolves.toBe("timeout");
    await expect(loadPrintFonts("   ", failing)).resolves.toBe("unsupported");
  });
});
