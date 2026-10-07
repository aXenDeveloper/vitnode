import { describe, expect, it } from "vitest";

import { normalizeAiOverviewSearch } from "./route-search";

describe("normalizeAiOverviewSearch", () => {
  it("keeps the settings sheet open alongside the range", () => {
    expect(
      normalizeAiOverviewSearch({ range: "7d", settings: "open" }),
    ).toEqual({ range: "7d", settings: "open" });
  });

  it("drops any other settings value", () => {
    expect(normalizeAiOverviewSearch({ settings: "true" })).toEqual({});
    expect(normalizeAiOverviewSearch({ settings: ["open"] })).toEqual({});
  });
});
