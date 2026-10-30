import { describe, expect, it } from "vitest";

import { normalizeActivitySearch } from "./activity-search";

describe("normalizeActivitySearch", () => {
  it("keeps every recognised filter", () => {
    const search = {
      action: "role.updated",
      actorId: 7,
      area: "admin",
      from: "2026-01-01",
      log: "12",
      pluginId: "@vitnode/blog",
      search: "News",
      targetId: "42",
      targetType: "blog.category",
      to: "2026-01-31",
    };

    expect(normalizeActivitySearch(search)).toEqual({
      ...search,
      log: 12,
    });
  });

  it.each([
    ["action", "Role Updated"],
    ["actorId", "-1"],
    ["actorId", "1.5"],
    ["area", "superadmin"],
    ["from", "01/01/2026"],
    ["log", "0"],
    ["pluginId", "<script>"],
    ["search", "   "],
    ["targetId", "a b"],
    ["targetType", "Blog Category"],
    ["to", "tomorrow"],
  ])("drops an invalid %s (%s)", (key, value) => {
    expect(normalizeActivitySearch({ [key]: value })).toEqual({});
  });

  it("trims the search and drops unknown keys", () => {
    expect(
      normalizeActivitySearch({ search: "  role  ", unknown: "x" }),
    ).toEqual({ search: "role" });
  });
});
