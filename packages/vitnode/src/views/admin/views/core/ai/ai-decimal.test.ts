import { describe, expect, it } from "vitest";

import { fromAiDecimal, toAiDecimal } from "./ai-decimal";

describe("toAiDecimal", () => {
  it("writes a plain decimal without trailing zeros", () => {
    expect(toAiDecimal(25)).toBe("25");
    expect(toAiDecimal(25.5)).toBe("25.5");
    expect(toAiDecimal(0.000_000_1, 8)).toBe("0.0000001");
  });

  it("never writes exponent notation or a negative amount", () => {
    expect(toAiDecimal(1e-7)).toBe("0");
    expect(toAiDecimal(-3)).toBe("0");
  });

  it("reads the API's string back, keeping null as null", () => {
    expect(fromAiDecimal("12.50")).toBe(12.5);
    expect(fromAiDecimal(null)).toBeNull();
  });
});
