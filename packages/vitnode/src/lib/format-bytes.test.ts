import { describe, expect, it } from "vitest";

import { formatBytes } from "./format-bytes";

describe("formatBytes", () => {
  it("returns 0 B for zero, negative and non-finite input", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 B");
  });

  it("keeps bytes whole and does not add decimals", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("scales to the correct binary unit", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("respects the decimals argument", () => {
    expect(formatBytes(1536, 2)).toBe("1.5 KB");
    expect(formatBytes(1590, 2)).toBe("1.55 KB");
    expect(formatBytes(1590, 0)).toBe("2 KB");
  });

  it("caps at the largest known unit", () => {
    expect(formatBytes(1024 ** 5)).toBe("1 PB");
    expect(formatBytes(1024 ** 6)).toContain("PB");
  });
});
