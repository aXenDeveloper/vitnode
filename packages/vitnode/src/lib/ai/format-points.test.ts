import { describe, expect, it } from "vitest";

import { formatAiPoints, formatAiUsd } from "./format-points";

describe("formatAiPoints", () => {
  it("shows at most one decimal place", () => {
    expect(formatAiPoints("12")).toBe("12");
    expect(formatAiPoints("0.3")).toBe("0.3");
    expect(formatAiPoints("32.85")).toBe("32.8");
  });

  it("never shows a positive amount as zero", () => {
    expect(formatAiPoints("0.0001")).toBe("<0.1");
    expect(formatAiPoints("0")).toBe("0");
  });

  it("shows an unlimited allowance as infinity", () => {
    expect(formatAiPoints(null)).toBe("∞");
  });
});

describe("formatAiUsd", () => {
  it("keeps sub-cent costs readable", () => {
    expect(formatAiUsd("0.0003")).toBe("$0.0003");
    expect(formatAiUsd("25")).toBe("$25.00");
    expect(formatAiUsd(null)).toBe("—");
  });
});
