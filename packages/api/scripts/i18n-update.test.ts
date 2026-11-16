import { describe, expect, it } from "vitest";

import { reconcileTree } from "./i18n-update";

describe("reconcileTree", () => {
  it("adds new keys from English, keeps existing translations", () => {
    const english = {
      core: { cancel: "Cancel", greeting: "Hello", save: "Save" },
    };
    const current = { core: { save: "Zapisz" } };

    expect(reconcileTree(english, current)).toEqual({
      core: { cancel: "Cancel", greeting: "Hello", save: "Zapisz" },
    });
  });

  it("drops keys English no longer has", () => {
    const english = { core: { save: "Save" } };
    const current = { core: { legacy: "Stare", save: "Zapisz" } };

    expect(reconcileTree(english, current)).toEqual({
      core: { save: "Zapisz" },
    });
  });

  it("follows English shape, taking English order", () => {
    const english = { a: "A", b: "B", c: "C" };
    const current = { c: "Ce", a: "Ael" };

    expect(Object.keys(reconcileTree(english, current))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("recurses into nested objects, adding and pruning at every level", () => {
    const english = {
      "@vitnode/blog": {
        posts: { create: "Create", title: "Title" },
        shared: "Shared",
      },
    };
    const current = {
      "@vitnode/blog": {
        posts: { gone: "Zniknęło", title: "Tytuł" },
      },
    };

    expect(reconcileTree(english, current)).toEqual({
      "@vitnode/blog": {
        posts: { create: "Create", title: "Tytuł" },
        shared: "Shared",
      },
    });
  });

  it("replaces a leaf with English's object shape when they disagree", () => {
    const english = { auth: { reset: { email: "Mail" } } };
    // The translation had `auth.reset` as a bare string - stale shape.
    const current = { auth: { reset: "Reset" } };

    expect(reconcileTree(english, current)).toEqual({
      auth: { reset: { email: "Mail" } },
    });
  });

  it("does not mutate its inputs", () => {
    const english = { core: { a: "A", b: "B" } };
    const current = { core: { a: "Ax" } };
    reconcileTree(english, current);

    expect(english).toEqual({ core: { a: "A", b: "B" } });
    expect(current).toEqual({ core: { a: "Ax" } });
  });
});
