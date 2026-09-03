import { describe, expect, it } from "vitest";

import type { ContentAdminSlots } from "./slots";

import {
  contentAdminSlots,
  registeredContentRowPanels,
  setContentAdminSlots,
} from "./slots";

const panel = (name: string) => {
  const component = () => null;

  Object.defineProperty(component, "name", { value: name });

  return component;
};

const dialog = (name: string) => {
  const component = () => null;

  Object.defineProperty(component, "name", { value: name });

  return component;
};

describe("before anything registers", () => {
  it("is empty, and empty is a supported state", () => {
    expect(contentAdminSlots()).toEqual({});
  });

  it("offers no editorial action nobody can open", () => {
    expect(registeredContentRowPanels({})).toEqual([]);
  });
});

describe("first registration", () => {
  it("records exactly what it was handed", () => {
    const FormDialog = dialog("first");

    setContentAdminSlots({ FormDialog });

    expect(contentAdminSlots().FormDialog).toBe(FormDialog);
  });

  it("records a panel under the action id it is for", () => {
    const history = panel("history");

    setContentAdminSlots({ rowPanels: { history } });

    expect(contentAdminSlots().rowPanels?.history).toBe(history);
    expect(registeredContentRowPanels()).toContain("history");
  });
});

describe("two independent modules, in either order", () => {
  it("keeps both, whichever registered first", () => {
    const FormDialog = dialog("form-module");
    const history = panel("editorial-module");

    setContentAdminSlots({ FormDialog });
    setContentAdminSlots({ rowPanels: { history } });

    expect(contentAdminSlots().FormDialog).toBe(FormDialog);
    expect(contentAdminSlots().rowPanels?.history).toBe(history);
  });

  it("does not let a panel registration erase the dialog", () => {
    const FormDialog = dialog("kept");

    setContentAdminSlots({ FormDialog });
    setContentAdminSlots({ rowPanels: { delivery: panel("delivery") } });

    expect(contentAdminSlots().FormDialog).toBe(FormDialog);
  });

  it("does not let a dialog registration erase the panels", () => {
    const history = panel("kept");

    setContentAdminSlots({ rowPanels: { history } });
    setContentAdminSlots({ FormDialog: dialog("late") });

    expect(contentAdminSlots().rowPanels?.history).toBe(history);
  });
});

describe("the same module registering again after a hot reload", () => {
  it("replaces its own dialog with the newer component", () => {
    const before = dialog("before");
    const after = dialog("after");

    setContentAdminSlots({ FormDialog: before });
    setContentAdminSlots({ FormDialog: after });

    expect(contentAdminSlots().FormDialog).toBe(after);
    expect(contentAdminSlots().FormDialog).not.toBe(before);
  });

  it("replaces its own panel with the newer component", () => {
    const before = panel("before");
    const after = panel("after");

    setContentAdminSlots({ rowPanels: { history: before } });
    setContentAdminSlots({ rowPanels: { history: after } });

    expect(contentAdminSlots().rowPanels?.history).toBe(after);
  });

  it("replaces one panel without dropping its siblings", () => {
    const delivery = panel("delivery");
    const history = panel("history-v2");

    setContentAdminSlots({
      rowPanels: { delivery, history: panel("history-v1") },
    });
    setContentAdminSlots({ rowPanels: { history } });

    expect(contentAdminSlots().rowPanels?.delivery).toBe(delivery);
    expect(contentAdminSlots().rowPanels?.history).toBe(history);
  });

  it("never accumulates a second copy of a slot", () => {
    for (let reload = 0; reload < 5; reload++) {
      setContentAdminSlots({ rowPanels: { history: panel(`v${reload}`) } });
    }

    expect(
      Object.keys(contentAdminSlots().rowPanels ?? {}).filter(
        id => id === "history",
      ),
    ).toHaveLength(1);
  });
});

describe("which actions the row menu may offer", () => {
  /**
   * Read from the registry rather than from a list, so an action whose panel is
   * registered later becomes offerable without anything else changing - and one
   * whose panel nobody registered is never in the menu.
   */
  it("names exactly the actions something can open", () => {
    const slots: ContentAdminSlots = { rowPanels: { history: panel("h") } };

    expect(registeredContentRowPanels(slots)).toEqual(["history"]);
  });

  it("ignores an action id nothing registered", () => {
    expect(registeredContentRowPanels({ rowPanels: {} })).toEqual([]);
  });

  /**
   * `delete` is never in here and never needs to be: the list implements it
   * itself, so it is always renderable and the caller adds it.
   */
  it("never claims delete, which the list owns", () => {
    setContentAdminSlots({ rowPanels: { history: panel("h") } });

    expect(registeredContentRowPanels()).not.toContain("delete");
  });
});
