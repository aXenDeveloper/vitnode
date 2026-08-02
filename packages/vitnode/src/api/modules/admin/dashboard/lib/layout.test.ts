import { describe, expect, it } from "vitest";

import type { AdminDashboardWidgetLayoutItem } from "@/database/dashboard";

import {
  isSettingsTooLarge,
  mergeLayoutForSave,
  mergeWidgetSettings,
  zodWidgetId,
} from "./layout";

const item = (
  id: string,
  overrides: Partial<AdminDashboardWidgetLayoutItem> = {},
): AdminDashboardWidgetLayoutItem => ({ id, span: 1, rows: 1, ...overrides });

const merge = ({
  incoming,
  managed,
  previous,
}: {
  incoming: AdminDashboardWidgetLayoutItem[];
  managed?: string[];
  previous: AdminDashboardWidgetLayoutItem[];
}) =>
  mergeLayoutForSave({
    incoming: incoming as Required<AdminDashboardWidgetLayoutItem>[],
    managed: managed ?? previous.map(widget => widget.id),
    previous,
  });

describe("mergeLayoutForSave", () => {
  it("stores the board in the order the admin arranged it", () => {
    const merged = merge({
      incoming: [item("b"), item("a")],
      previous: [],
    });

    expect(merged.map(widget => widget.id)).toEqual(["b", "a"]);
  });

  it("carries a widget's settings across a rearrange", () => {
    const merged = merge({
      incoming: [item("notes", { span: 3, rows: 2 })],
      previous: [item("notes", { settings: { content: "buy milk" } })],
    });

    expect(merged[0]).toEqual({
      id: "notes",
      span: 3,
      rows: 2,
      settings: { content: "buy milk" },
    });
  });

  it("ignores settings the client tries to smuggle in", () => {
    const merged = merge({
      incoming: [
        item("notes", { settings: { content: "injected" } }),
      ] as AdminDashboardWidgetLayoutItem[],
      previous: [item("notes", { settings: { content: "real" } })],
    });

    expect(merged[0].settings).toEqual({ content: "real" });
  });

  // Without this a `defaultEnabled` widget can never be removed - the
  // normalizer puts it straight back on the next load.
  it("remembers a removed widget as hidden", () => {
    const merged = merge({
      incoming: [item("a")],
      previous: [item("a"), item("notes")],
    });

    expect(merged).toEqual([item("a"), { ...item("notes"), hidden: true }]);
  });

  it("remembers a removed widget the admin had never saved", () => {
    const merged = merge({
      incoming: [item("a")],
      managed: ["a", "notes"],
      previous: [],
    });

    expect(merged).toEqual([item("a"), { id: "notes", hidden: true }]);
  });

  it("writes one entry for a managed id sent twice", () => {
    const merged = merge({
      incoming: [],
      managed: ["notes", "notes"],
      previous: [],
    });

    expect(merged).toEqual([{ id: "notes", hidden: true }]);
  });

  it("keeps a removed widget's settings so they survive re-adding it", () => {
    const merged = merge({
      incoming: [],
      previous: [item("notes", { settings: { content: "keep me" } })],
    });

    expect(merged[0]).toMatchObject({
      hidden: true,
      settings: { content: "keep me" },
    });
  });

  it("clears the hidden flag when the widget is placed again", () => {
    const merged = merge({
      incoming: [item("notes")],
      previous: [item("notes", { hidden: true })],
    });

    expect(merged[0].hidden).toBeUndefined();
  });

  it("drops duplicate ids from the client", () => {
    const merged = merge({
      incoming: [item("a", { span: 2 }), item("a", { span: 3 })],
      previous: [],
    });

    expect(merged).toEqual([item("a", { span: 2 })]);
  });

  it("keeps every copy of a repeatable widget, each with its own settings", () => {
    const merged = merge({
      incoming: [item("send"), item("send#2"), item("send#3")],
      previous: [
        item("send", { settings: { to: "1" } }),
        item("send#2", { settings: { to: "2" } }),
      ],
    });

    expect(merged).toEqual([
      { id: "send", span: 1, rows: 1, settings: { to: "1" } },
      { id: "send#2", span: 1, rows: 1, settings: { to: "2" } },
      { id: "send#3", span: 1, rows: 1 },
    ]);
  });

  it("remembers a removed copy without touching its siblings", () => {
    const merged = merge({
      incoming: [item("send")],
      previous: [item("send"), item("send#2", { settings: { to: "2" } })],
    });

    expect(merged).toEqual([
      { id: "send", span: 1, rows: 1 },
      { id: "send#2", span: 1, rows: 1, settings: { to: "2" }, hidden: true },
    ]);
  });

  // The client never saw these, so it cannot have been asked to remove them.
  // Hiding them would mean losing the card for good once the plugin or the
  // permission came back.
  it("leaves an entry the client could not account for alone", () => {
    const merged = merge({
      incoming: [item("a")],
      managed: ["a"],
      previous: [item("a"), item("gone", { settings: { keep: true } })],
    });

    expect(merged[1]).toEqual(item("gone", { settings: { keep: true } }));
  });

  it("does not resurrect a hidden entry it could not account for either", () => {
    const merged = merge({
      incoming: [],
      managed: [],
      previous: [item("gone", { hidden: true })],
    });

    expect(merged).toEqual([item("gone", { hidden: true })]);
  });
});

describe("mergeWidgetSettings", () => {
  // A `defaultEnabled` card is on screen from the very first load, long before
  // the admin has arranged anything - what they type into it has to land.
  it("creates the entry when the admin has never arranged their board", () => {
    const merged = mergeWidgetSettings({
      previous: [],
      settings: { content: "first note" },
      widgetId: "@vitnode/core:notes",
    });

    expect(merged).toEqual([
      { id: "@vitnode/core:notes", settings: { content: "first note" } },
    ]);
  });

  // Left to the normalizer, which knows the widget's own defaults.
  it("leaves a created entry unsized", () => {
    const [created] = mergeWidgetSettings({
      previous: [],
      settings: {},
      widgetId: "notes",
    });

    expect(created.span).toBeUndefined();
    expect(created.rows).toBeUndefined();
  });

  it("merges into an existing entry without touching its size", () => {
    const merged = mergeWidgetSettings({
      previous: [item("notes", { span: 3, settings: { content: "a", to: 1 } })],
      settings: { content: "b" },
      widgetId: "notes",
    });

    expect(merged).toEqual([
      item("notes", { span: 3, settings: { content: "b", to: 1 } }),
    ]);
  });

  // The route caps what it stores, and the patch is spread over the bag that is
  // already there - so a pair of patches that each pass on their own can still
  // add up past the cap. It has to be the merged result that is measured.
  it("grows past the cap on a patch that fits on its own", () => {
    const half = { a: "x".repeat(40 * 1024) };
    const patch = { b: "x".repeat(40 * 1024) };
    expect(isSettingsTooLarge(half)).toBe(false);
    expect(isSettingsTooLarge(patch)).toBe(false);

    const [merged] = mergeWidgetSettings({
      previous: [item("notes", { settings: half })],
      settings: patch,
      widgetId: "notes",
    });

    expect(isSettingsTooLarge(merged.settings)).toBe(true);
  });

  it("leaves every other copy alone", () => {
    const merged = mergeWidgetSettings({
      previous: [item("send"), item("send#2", { settings: { to: "2" } })],
      settings: { to: "1" },
      widgetId: "send",
    });

    expect(merged).toEqual([
      item("send", { settings: { to: "1" } }),
      item("send#2", { settings: { to: "2" } }),
    ]);
  });
});

describe("zodWidgetId", () => {
  it("accepts a widget id", () => {
    expect(zodWidgetId.safeParse("@vitnode/core:notes").success).toBe(true);
  });

  it("accepts a copy of one", () => {
    expect(zodWidgetId.safeParse("@vitnode/core:notes#2").success).toBe(true);
  });

  it("rejects a malformed copy suffix", () => {
    expect(zodWidgetId.safeParse("@vitnode/core:notes#").success).toBe(false);
    expect(zodWidgetId.safeParse("@vitnode/core:notes#abc").success).toBe(
      false,
    );
    expect(zodWidgetId.safeParse("@vitnode/core:notes#2#3").success).toBe(
      false,
    );
  });

  it("still rejects an id with no plugin part", () => {
    expect(zodWidgetId.safeParse("notes#2").success).toBe(false);
  });
});

describe("isSettingsTooLarge", () => {
  it("accepts an ordinary note", () => {
    expect(isSettingsTooLarge({ content: "a short note" })).toBe(false);
  });

  it("accepts undefined", () => {
    expect(isSettingsTooLarge(undefined)).toBe(false);
  });

  it("rejects settings past the 64 KB cap", () => {
    expect(isSettingsTooLarge({ content: "x".repeat(65 * 1024) })).toBe(true);
  });

  // Counted in bytes, not characters, or the cap would be four times looser for
  // a note written in a script that does not fit in one byte per character.
  it("counts a multi-byte character as the bytes it takes", () => {
    expect(isSettingsTooLarge({ content: "€".repeat(30 * 1024) })).toBe(true);
    expect(isSettingsTooLarge({ content: "€".repeat(10 * 1024) })).toBe(false);
  });
});
