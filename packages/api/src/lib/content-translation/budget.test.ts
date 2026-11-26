import { describe, expect, it } from "vitest";

import { fitsContentTranslationBudget } from "./budget";

describe("fitsContentTranslationBudget", () => {
  it.each<[string, null | string, string, string | undefined, boolean]>([
    ["no dedicated cap", null, "1000", "50", true],
    ["spend under the cap", "5", "4.99", undefined, true],
    ["spend at the cap", "5", "5", undefined, true],
    ["spend over the cap", "5", "5.000000000001", undefined, false],
    ["an estimate that still fits", "5", "4.5", "0.5", true],
    ["an estimate that would overspend", "5", "4.5", "0.500000000001", false],
    ["a zero cap", "0", "0", "0.000001", false],
  ])("%s", (_case, cap, spent, extra, fits) => {
    expect(fitsContentTranslationBudget(cap, spent, extra)).toBe(fits);
  });
});
