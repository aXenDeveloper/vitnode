import { describe, expect, it } from "vitest";

import type {
  DashboardLayoutItem,
  DashboardWidgetOption,
} from "../widgets/types";

import { dashboardLayoutReducer, isLayoutDirty } from "./layout-reducer";

const item = (id: string, span: 1 | 2 | 3 = 1): DashboardLayoutItem => ({
  id,
  span,
  rows: 1,
});

const option = (
  id: string,
  overrides: Partial<DashboardWidgetOption> = {},
): DashboardWidgetOption => ({
  id,
  title: id,
  category: { id: "@vitnode/core", title: "Core" },
  minSpan: 1,
  defaultSpan: 1,
  defaultRows: 1,
  ...overrides,
});

describe("dashboardLayoutReducer", () => {
  describe("add", () => {
    it("appends to the end when no index is given", () => {
      const state = [item("a")];

      expect(
        dashboardLayoutReducer(state, {
          type: "add",
          widget: option("b", { defaultSpan: 2, defaultRows: 3 }),
        }),
      ).toEqual([item("a"), { id: "b", span: 2, rows: 3 }]);
    });

    it("inserts at the drop index", () => {
      const state = [item("a"), item("b")];
      const next = dashboardLayoutReducer(state, {
        type: "add",
        widget: option("c"),
        index: 1,
      });

      expect(next.map(entry => entry.id)).toEqual(["a", "c", "b"]);
    });

    it("respects minSpan over a smaller defaultSpan", () => {
      const next = dashboardLayoutReducer([], {
        type: "add",
        widget: option("wide", { minSpan: 2, defaultSpan: 1 }),
      });

      expect(next[0].span).toBe(2);
    });

    it("ignores a widget that is already on the board", () => {
      const state = [item("a")];

      expect(
        dashboardLayoutReducer(state, { type: "add", widget: option("a") }),
      ).toBe(state);
    });

    it("adds another copy of a widget that allows several", () => {
      const state = [item("a")];
      const next = dashboardLayoutReducer(state, {
        type: "add",
        widget: option("a", { allowMultiple: true }),
      });

      expect(next.map(entry => entry.id)).toEqual(["a", "a#2"]);
    });

    it("keeps numbering further copies", () => {
      const state = [item("a"), item("a#2")];
      const next = dashboardLayoutReducer(state, {
        type: "add",
        widget: option("a", { allowMultiple: true }),
      });

      expect(next.map(entry => entry.id)).toEqual(["a", "a#2", "a#3"]);
    });

    // The first copy of a repeatable widget is a plain id, so a layout saved
    // before `allowMultiple` existed keeps working.
    it("gives the first copy the plain widget id", () => {
      const next = dashboardLayoutReducer([], {
        type: "add",
        widget: option("a", { allowMultiple: true }),
      });

      expect(next.map(entry => entry.id)).toEqual(["a"]);
    });

    it("inserts a copy at the drop index", () => {
      const state = [item("a"), item("b")];
      const next = dashboardLayoutReducer(state, {
        type: "add",
        widget: option("a", { allowMultiple: true }),
        index: 1,
      });

      expect(next.map(entry => entry.id)).toEqual(["a", "a#2", "b"]);
    });
  });

  describe("move", () => {
    it("reorders an item", () => {
      const state = [item("a"), item("b"), item("c")];
      const next = dashboardLayoutReducer(state, {
        type: "move",
        index: 0,
        toIndex: 2,
      });

      expect(next.map(entry => entry.id)).toEqual(["b", "c", "a"]);
    });

    it("is a no-op when the position does not change", () => {
      const state = [item("a"), item("b")];

      expect(
        dashboardLayoutReducer(state, { type: "move", index: 1, toIndex: 1 }),
      ).toBe(state);
    });

    it("is a no-op for an out-of-range index", () => {
      const state = [item("a")];

      expect(
        dashboardLayoutReducer(state, { type: "move", index: 5, toIndex: 0 }),
      ).toBe(state);
    });
  });

  describe("remove", () => {
    it("drops the widget", () => {
      const state = [item("a"), item("b")];

      expect(
        dashboardLayoutReducer(state, { type: "remove", id: "a" }),
      ).toEqual([item("b")]);
    });

    it("is a no-op for an unknown id", () => {
      const state = [item("a")];

      expect(dashboardLayoutReducer(state, { type: "remove", id: "z" })).toBe(
        state,
      );
    });
  });

  describe("resize", () => {
    it("changes only the targeted widget's span", () => {
      const state = [item("a"), item("b")];
      const next = dashboardLayoutReducer(state, {
        type: "resize",
        id: "b",
        span: 3,
      });

      expect(next).toEqual([item("a"), item("b", 3)]);
    });
  });

  it("reset replaces the whole state", () => {
    const target = [item("z")];

    expect(
      dashboardLayoutReducer([item("a")], { type: "reset", state: target }),
    ).toBe(target);
  });
});

describe("isLayoutDirty", () => {
  it("is false for an identical layout", () => {
    expect(isLayoutDirty([item("a"), item("b")], [item("a"), item("b")])).toBe(
      false,
    );
  });

  it("notices a different length", () => {
    expect(isLayoutDirty([item("a")], [item("a"), item("b")])).toBe(true);
  });

  it("notices a reorder", () => {
    expect(isLayoutDirty([item("b"), item("a")], [item("a"), item("b")])).toBe(
      true,
    );
  });

  it("notices a resize", () => {
    expect(isLayoutDirty([item("a", 3)], [item("a", 1)])).toBe(true);
  });

  it("ignores settings changes - the widget owns those", () => {
    expect(
      isLayoutDirty(
        [{ ...item("a"), settings: { content: "new" } }],
        [{ ...item("a"), settings: { content: "old" } }],
      ),
    ).toBe(false);
  });
});
