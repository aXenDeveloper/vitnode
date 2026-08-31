import { describe, expect, it } from "vitest";

import type { ContentAdminSlots } from "./slots";

import {
  contentAdminSlots,
  registeredContentRowPanels,
  setContentAdminSlots,
} from "./slots";

/**
 * The one registry in this package that **merges** rather than replaces, and
 * what that costs and buys across a module's lifetime.
 *
 * Every other runtime bridge here - `setAuthTransport`, `setAdminTransport`,
 * `setContentFrontendRegistry`, `configureIntl` - holds one value from one
 * registrar, so last-write-wins is the whole rule. This one is filled by two
 * independent modules: the form module registers `FormDialog`, the editorial
 * module registers `rowPanels`, and neither knows whether the other loaded.
 * Replacing wholesale would mean whichever imported second silently erased the
 * first, and which one that is depends on chunk order.
 *
 * So the merge is the feature, and the transitions below say exactly how far it
 * goes: **per slot**, last write wins; **across slots**, nothing is lost. A hot
 * reload of the editorial module therefore replaces its own panels with the new
 * components - no stale closure over the previous module - while leaving the
 * form module's dialog alone, which is the behaviour a dev server needs from it.
 *
 * ## The one thing it deliberately cannot do
 *
 * Un-register. A module that *stops* registering a panel leaves the previous one
 * in place until the page reloads, because a merge has no way to express
 * absence. That is stated here rather than fixed: adding a clear would let the
 * two registrars erase each other again, and the case it would serve - deleting
 * a panel and expecting it to vanish without a reload - is one a full reload
 * already handles. Agent G's smoke list carries it.
 */

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

  /**
   * A list screen is still a working screen with nothing registered:
   * page-mode content types keep their create and edit pages, and every content
   * type keeps publish and delete. What is *not* offered is an editorial action
   * whose panel nobody registered - a menu entry that opens nothing is worse
   * than an absent one.
   */
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
  /**
   * The stale-closure case. A re-evaluated module hands over new component
   * objects, and the registry must be showing those rather than the ones the
   * previous instance closed over.
   */
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

  /**
   * A module that registers two panels and re-registers one of them keeps the
   * other. Which is the same rule as across modules, one level down - the merge
   * is per key, not per call.
   */
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
