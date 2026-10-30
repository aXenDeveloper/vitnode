import { describe, expect, it } from "vitest";

import { defineAuditActions } from "./actions";
import { AUDIT_ACTION_MAX_LENGTH } from "./const";

describe("defineAuditActions", () => {
  it("returns valid declarations unchanged", () => {
    const actions = [
      { action: "topic.moved", targetType: "topic" },
      { action: "post.status_changed", targetType: "forum.post" },
    ] as const;

    expect(defineAuditActions(actions)).toBe(actions);
  });

  it.each([
    ["an uppercase action", [{ action: "Topic.Moved", targetType: "topic" }]],
    ["a trailing dot", [{ action: "topic.", targetType: "topic" }]],
    [
      "an action over the length limit",
      [{ action: "a".repeat(AUDIT_ACTION_MAX_LENGTH + 1), targetType: "t" }],
    ],
    [
      "a target type with spaces",
      [{ action: "topic.moved", targetType: "a b" }],
    ],
    [
      "a duplicate action",
      [
        { action: "topic.moved", targetType: "topic" },
        { action: "topic.moved", targetType: "post" },
      ],
    ],
  ])("throws for %s", (_label, actions) => {
    expect(() => defineAuditActions(actions)).toThrow();
  });
});
