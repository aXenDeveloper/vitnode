import { describe, expect, it } from "vitest";

import { ssoBrandForeground } from "./brand";

describe("picking the text color for a brand-filled SSO button", () => {
  it("keeps white text on saturated brand colors that carry it", () => {
    expect(ssoBrandForeground("#5865f2")).toBe("#ffffff");
    expect(ssoBrandForeground("#0866ff")).toBe("#ffffff");
    expect(ssoBrandForeground("#000")).toBe("#ffffff");
  });

  it("switches to dark text on light brand colors", () => {
    expect(ssoBrandForeground("#ffcc00")).toBe("#0a0a0a");
    expect(ssoBrandForeground("#fff")).toBe("#0a0a0a");
    expect(ssoBrandForeground("#00a4ef")).toBe("#0a0a0a");
  });
});
