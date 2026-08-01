import { describe, expect, it } from "vitest";

import type { DashboardWidgetOption } from "../widgets/types";

import { groupWidgets, matchesWidgetQuery } from "./group-widgets";

const option = (
  id: string,
  category: string,
  overrides: Partial<DashboardWidgetOption> = {},
): DashboardWidgetOption => ({
  id,
  title: `Title ${id}`,
  category: { id: category, title: `Category ${category}` },
  minSpan: 1,
  defaultSpan: 1,
  defaultRows: 1,
  ...overrides,
});

describe("groupWidgets", () => {
  it("buckets widgets under their own category", () => {
    const groups = groupWidgets({
      widgets: [
        option("notes", "@vitnode/core"),
        option("stats", "@vitnode/blog:content"),
        option("hits", "@vitnode/blog:content"),
      ],
    });

    expect(groups.map(group => [group.id, group.widgets.length])).toEqual([
      ["@vitnode/core", 1],
      ["@vitnode/blog:content", 2],
    ]);
  });

  it("keeps the order the resolver handed widgets over in", () => {
    const groups = groupWidgets({
      widgets: [
        option("a", "second"),
        option("b", "first"),
        option("c", "second"),
      ],
    });

    expect(groups.map(group => group.id)).toEqual(["second", "first"]);
    expect(groups[0].widgets.map(widget => widget.id)).toEqual(["a", "c"]);
  });

  it("titles each group from its category", () => {
    const [group] = groupWidgets({ widgets: [option("notes", "core")] });

    expect(group.title).toBe("Category core");
  });

  it("filters by title", () => {
    const groups = groupWidgets({
      query: "notes",
      widgets: [option("notes", "core"), option("stats", "core")],
    });

    expect(groups[0].widgets.map(widget => widget.id)).toEqual(["notes"]);
  });

  it("drops a group the search empties out", () => {
    const groups = groupWidgets({
      query: "notes",
      widgets: [option("notes", "core"), option("stats", "blog")],
    });

    expect(groups.map(group => group.id)).toEqual(["core"]);
  });

  it("returns nothing when the search matches nothing", () => {
    expect(
      groupWidgets({ query: "nope", widgets: [option("notes", "core")] }),
    ).toEqual([]);
  });

  it("returns every group when the search is blank", () => {
    const widgets = [option("notes", "core"), option("stats", "blog")];

    expect(groupWidgets({ query: "   ", widgets })).toHaveLength(2);
    expect(groupWidgets({ widgets })).toHaveLength(2);
  });
});

describe("matchesWidgetQuery", () => {
  const widget = option("stats", "@vitnode/blog", {
    title: "Blog statistics",
    desc: "Posts, comments and views at a glance.",
    category: { id: "@vitnode/blog", title: "Blog" },
  });

  it("matches part of a title, ignoring case", () => {
    expect(matchesWidgetQuery(widget, "STATIST")).toBe(true);
  });

  it("matches the description", () => {
    expect(matchesWidgetQuery(widget, "comments")).toBe(true);
  });

  // Searching the plugin's name is how an admin finds "everything Blog adds".
  it("matches the group the widget sits under", () => {
    expect(matchesWidgetQuery(widget, "blog")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(matchesWidgetQuery(widget, "  blog  ")).toBe(true);
  });

  it("does not match an unrelated word", () => {
    expect(matchesWidgetQuery(widget, "forum")).toBe(false);
  });

  it("matches a widget with no description", () => {
    expect(matchesWidgetQuery(option("bare", "core"), "bare")).toBe(true);
  });
});
