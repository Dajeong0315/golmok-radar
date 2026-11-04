import { describe, expect, it } from "vitest";

import { consumeAuthReturnHash, rememberAuthReturnHash } from "./authReturn";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("OAuth return route", () => {
  it("restores the page after the OAuth token replaces the URL fragment", () => {
    const session = storage();
    rememberAuthReturnHash(session, "#explore?focus=3120052");
    expect(consumeAuthReturnHash(session, null)).toBe("#explore?focus=3120052");
    expect(consumeAuthReturnHash(session, null)).toBeNull();
  });

  it("prefers the protected anonymous transfer destination", () => {
    const session = storage();
    rememberAuthReturnHash(session, "#home");
    expect(consumeAuthReturnHash(session, "#worksheet")).toBe("#worksheet");
  });
});
