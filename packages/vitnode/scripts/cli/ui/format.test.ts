// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  formatByteDelta,
  formatBytes,
  formatDuration,
  formatPercentDelta,
  plural,
  toDisplayPath,
} from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [999, "999 B"],
    [1000, "1.0 kB"],
    [1024, "1.0 kB"],
    [100_000, "100.0 kB"],
    [184_234, "184.2 kB"],
    [999_949, "999.9 kB"],
    [999_999, "1.0 MB"],
    [1_000_000, "1.0 MB"],
    [1_400_000, "1.4 MB"],
    [55_200_000, "55.2 MB"],
    [2_500_000_000, "2.5 GB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it("keeps the sign of a negative size", () => {
    expect(formatBytes(-12_800)).toBe("-12.8 kB");
  });
});

describe("size changes", () => {
  it("always signs a byte delta", () => {
    expect(formatByteDelta(4200)).toBe("+4.2 kB");
    expect(formatByteDelta(-12_800)).toBe("-12.8 kB");
    expect(formatByteDelta(0)).toBe("0 B");
  });

  it("always signs a percentage delta", () => {
    expect(formatPercentDelta(0.023)).toBe("+2.3%");
    expect(formatPercentDelta(-0.02)).toBe("-2.0%");
  });
});

describe("formatDuration", () => {
  it.each([
    [18, "18ms"],
    [6800, "6.8s"],
    [72_000, "1m 12s"],
  ])("formats %dms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("small helpers", () => {
  it("pluralizes", () => {
    expect(plural(1, "plugin")).toBe("1 plugin");
    expect(plural(3, "plugin")).toBe("3 plugins");
  });

  it("prints Windows paths with forward slashes", () => {
    expect(toDisplayPath(String.raw`dist\client\assets\index.js`)).toBe(
      "dist/client/assets/index.js",
    );
  });
});
