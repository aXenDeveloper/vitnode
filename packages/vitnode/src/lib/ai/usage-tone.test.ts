import { describe, expect, it } from "vitest";

import { aiUsageTone } from "./usage-tone";

describe("aiUsageTone", () => {
  it("stays calm below 80% used", () => {
    expect(aiUsageTone(0)).toBe("normal");
    expect(aiUsageTone(0.79)).toBe("normal");
  });

  it("warns from 80% used", () => {
    expect(aiUsageTone(0.8)).toBe("warning");
    expect(aiUsageTone(0.89)).toBe("warning");
  });

  it("turns critical from 90% used, and past the limit", () => {
    expect(aiUsageTone(0.9)).toBe("critical");
    expect(aiUsageTone(1.4)).toBe("critical");
  });
});
