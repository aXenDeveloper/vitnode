import { describe, expect, it } from "vitest";

import { ssoBrandColors } from "./brand";

describe("coloring a brand-filled SSO button", () => {
  it("keeps white text on saturated brand colors that carry it", () => {
    expect(ssoBrandColors("#5865f2").foreground).toBe("#ffffff");
    expect(ssoBrandColors("#0866ff").foreground).toBe("#ffffff");
    expect(ssoBrandColors("#000").foreground).toBe("#ffffff");
  });

  it("switches to dark text on light brand colors", () => {
    expect(ssoBrandColors("#ffcc00").foreground).toBe("#0a0a0a");
    expect(ssoBrandColors("#fff").foreground).toBe("#0a0a0a");
    expect(ssoBrandColors("#00a4ef").foreground).toBe("#0a0a0a");
  });

  it("moves the hover color away from the text so contrast never drops", () => {
    expect(ssoBrandColors("#5865f2").hover).toBe("#4d59d5");
    expect(ssoBrandColors("#ffcc00").hover).toBe("#ffd21f");
  });
});
