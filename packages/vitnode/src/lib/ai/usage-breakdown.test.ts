import { describe, expect, it } from "vitest";

import type { AiUsageSegment } from "./usage-breakdown";

import { aiUsageBreakdown } from "./usage-breakdown";

const action = (key: string, monthPoints: string) => ({ key, monthPoints });

const keysOf = (segments: AiUsageSegment<ReturnType<typeof action>>[]) =>
  segments.map(segment =>
    segment.kind === "action"
      ? segment.action.key
      : `${String(segment.count)} other`,
  );

describe("aiUsageBreakdown", () => {
  it("orders the features by the points they used, leaving unused ones out", () => {
    const segments = aiUsageBreakdown([
      action("tags", "10"),
      action("reply", "0"),
      action("summarize", "30"),
    ]);

    expect(keysOf(segments)).toEqual(["summarize", "tags"]);
    expect(segments.map(segment => segment.share)).toEqual([0.75, 0.25]);
  });

  it("folds everything after the top three into one segment", () => {
    const segments = aiUsageBreakdown([
      action("a", "50"),
      action("b", "20"),
      action("c", "15"),
      action("d", "10"),
      action("e", "5"),
    ]);

    expect(keysOf(segments)).toEqual(["a", "b", "c", "2 other"]);
    expect(segments.at(-1)).toMatchObject({ points: 15, share: 0.15 });
  });

  it("names a fourth feature instead of calling it one other feature", () => {
    const segments = aiUsageBreakdown([
      action("a", "4"),
      action("b", "3"),
      action("c", "2"),
      action("d", "1"),
    ]);

    expect(keysOf(segments)).toEqual(["a", "b", "c", "d"]);
  });

  it("has nothing to show before any points were used", () => {
    expect(aiUsageBreakdown([action("a", "0")])).toEqual([]);
  });
});
