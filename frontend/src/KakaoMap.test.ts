import { describe, expect, it, vi } from "vitest";

import { detachMapLayers } from "./KakaoMap";


describe("KakaoMap cleanup", () => {
  it("detaches every marker and overlay from the previous map", () => {
    const first = { setMap: vi.fn() };
    const second = { setMap: vi.fn() };

    detachMapLayers([first, second]);

    expect(first.setMap).toHaveBeenCalledWith(null);
    expect(second.setMap).toHaveBeenCalledWith(null);
  });
});
