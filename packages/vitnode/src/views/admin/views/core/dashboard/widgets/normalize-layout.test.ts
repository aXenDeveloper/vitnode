import { describe, expect, it } from "vitest";

import type {
  AdminDashboardWidgetLayoutItem,
  ResolvedDashboardWidget,
} from "./types";

import { normalizeLayout } from "./normalize-layout";

/** Layouts come out of a jsonb column, so they can hold anything. */
const rawSaved = (
  ...items: Record<string, unknown>[]
): AdminDashboardWidgetLayoutItem[] =>
  items as unknown as AdminDashboardWidgetLayoutItem[];

const widget = (
  id: string,
  overrides: Partial<ResolvedDashboardWidget> = {},
): ResolvedDashboardWidget => ({
  id,
  component: () => null,
  category: { id: "@vitnode/core", title: "Core" },
  minSpan: 1,
  defaultSpan: 1,
  defaultRows: 1,
  title: id,
  ...overrides,
});

describe("normalizeLayout", () => {
  it("keeps the saved order of known widgets", () => {
    const widgets = [widget("a"), widget("b"), widget("c")];
    const saved = [
      { id: "c", span: 1 as const, rows: 1 as const },
      { id: "a", span: 1 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "c",
      "a",
    ]);
  });

  it("drops widgets that are no longer registered or permitted", () => {
    const widgets = [widget("a")];
    const saved = [
      { id: "a", span: 1 as const, rows: 1 as const },
      { id: "uninstalled", span: 2 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "a",
    ]);
  });

  it("drops duplicate ids", () => {
    const widgets = [widget("a")];
    const saved = [
      { id: "a", span: 1 as const, rows: 1 as const },
      { id: "a", span: 2 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets })).toHaveLength(1);
  });

  it("keeps every copy of a widget that allows several", () => {
    const widgets = [widget("a", { allowMultiple: true })];
    const saved = [
      { id: "a", span: 1 as const, rows: 1 as const },
      { id: "a#2", span: 2 as const, rows: 1 as const },
      { id: "a#3", span: 3 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "a",
      "a#2",
      "a#3",
    ]);
  });

  it("sizes each copy against the widget's own bounds", () => {
    const widgets = [widget("a", { allowMultiple: true, minSpan: 2 })];
    const saved = [
      { id: "a", span: 3 as const, rows: 1 as const },
      { id: "a#2", span: 1 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.span)).toEqual([
      3, 2,
    ]);
  });

  it("keeps each copy's own settings apart", () => {
    const widgets = [widget("a", { allowMultiple: true })];
    const saved = rawSaved(
      { id: "a", span: 1, rows: 1, settings: { note: "first" } },
      { id: "a#2", span: 1, rows: 1, settings: { note: "second" } },
    );

    expect(
      normalizeLayout({ saved, widgets }).map(item => item.settings),
    ).toEqual([{ note: "first" }, { note: "second" }]);
  });

  // Turning `allowMultiple` back off should tidy up rather than strand copies
  // the admin can no longer add.
  it("collapses copies of a widget that no longer allows them", () => {
    const widgets = [widget("a")];
    const saved = [
      { id: "a", span: 1 as const, rows: 1 as const },
      { id: "a#2", span: 2 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "a",
    ]);
  });

  it("drops a copy of an uninstalled widget", () => {
    const widgets = [widget("a", { allowMultiple: true })];
    const saved = [
      { id: "a#2", span: 1 as const, rows: 1 as const },
      { id: "uninstalled#2", span: 1 as const, rows: 1 as const },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "a#2",
    ]);
  });

  // Hiding the only copy still counts as "the admin has seen this widget".
  it("does not re-add a default-enabled widget removed as a copy", () => {
    const widgets = [
      widget("a", { allowMultiple: true, defaultEnabled: true }),
    ];
    const saved = [
      { id: "a#2", span: 1 as const, rows: 1 as const, hidden: true },
    ];

    expect(normalizeLayout({ saved, widgets })).toEqual([]);
  });

  it("appends default-enabled widgets the admin has never seen", () => {
    const widgets = [
      widget("a"),
      widget("fresh", { defaultEnabled: true, defaultSpan: 2, defaultRows: 3 }),
    ];
    const saved = [{ id: "a", span: 1 as const, rows: 1 as const }];

    expect(normalizeLayout({ saved, widgets })).toEqual([
      { id: "a", span: 1, rows: 1 },
      { id: "fresh", span: 2, rows: 3 },
    ]);
  });

  // Without this, removing a default-enabled widget is impossible: it comes
  // straight back on the next load.
  it("does not re-add a default-enabled widget the admin removed", () => {
    const widgets = [widget("notes", { defaultEnabled: true })];
    const saved = [
      { id: "notes", span: 1 as const, rows: 1 as const, hidden: true },
    ];

    expect(normalizeLayout({ saved, widgets })).toEqual([]);
  });

  it("keeps a removed widget out without disturbing the rest", () => {
    const widgets = [
      widget("a", { defaultEnabled: true }),
      widget("notes", { defaultEnabled: true }),
    ];
    const saved = [
      { id: "a", span: 2 as const, rows: 1 as const },
      { id: "notes", span: 1 as const, rows: 1 as const, hidden: true },
    ];

    expect(normalizeLayout({ saved, widgets }).map(item => item.id)).toEqual([
      "a",
    ]);
  });

  it("puts a removed widget back once it is placed again", () => {
    const widgets = [widget("notes", { defaultEnabled: true })];
    const saved = [{ id: "notes", span: 3 as const, rows: 2 as const }];

    expect(normalizeLayout({ saved, widgets })).toEqual([
      { id: "notes", span: 3, rows: 2 },
    ]);
  });

  it("leaves opt-in widgets off a fresh dashboard", () => {
    const widgets = [widget("opt-in"), widget("on", { defaultEnabled: true })];

    expect(
      normalizeLayout({ saved: [], widgets }).map(item => item.id),
    ).toEqual(["on"]);
  });

  it("clamps a saved span up to the widget's minSpan", () => {
    const widgets = [widget("wide", { minSpan: 2 })];
    const saved = [{ id: "wide", span: 1 as const, rows: 1 as const }];

    expect(normalizeLayout({ saved, widgets })[0].span).toBe(2);
  });

  it("clamps out-of-range spans and rows", () => {
    const widgets = [widget("a", { defaultSpan: 2, defaultRows: 2 })];

    expect(
      normalizeLayout({
        saved: rawSaved({ id: "a", span: 99, rows: -4 }),
        widgets,
      })[0],
    ).toMatchObject({ span: 3, rows: 1 });
  });

  it("falls back to the defaults when span or rows are missing", () => {
    const widgets = [widget("a", { defaultSpan: 3, defaultRows: 2 })];

    expect(
      normalizeLayout({ saved: rawSaved({ id: "a" }), widgets })[0],
    ).toMatchObject({ span: 3, rows: 2 });
  });

  // The shape a widget's own settings write leaves behind when it has to create
  // the entry: settings, and no size for it to have made up.
  it("sizes an entry a settings write created", () => {
    const widgets = [widget("notes", { defaultSpan: 2, defaultRows: 2 })];
    const saved = rawSaved({ id: "notes", settings: { content: "first" } });

    expect(normalizeLayout({ saved, widgets })[0]).toEqual({
      id: "notes",
      span: 2,
      rows: 2,
      settings: { content: "first" },
    });
  });

  it("preserves a widget's own settings", () => {
    const widgets = [widget("notes")];
    const saved = [
      {
        id: "notes",
        span: 1 as const,
        rows: 1 as const,
        settings: { content: "buy milk" },
      },
    ];

    expect(normalizeLayout({ saved, widgets })[0].settings).toEqual({
      content: "buy milk",
    });
  });
});
