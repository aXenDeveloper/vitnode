// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { ContentFormLayout } from "./plugin";

import { resolveContentFormLayout } from "./plugin";

const shared = (() => null) as ContentFormLayout;
const createOnly = (() => null) as ContentFormLayout;
const editOnly = (() => null) as ContentFormLayout;

describe("resolveContentFormLayout", () => {
  it("has no layout when a plugin registered none", () => {
    expect(resolveContentFormLayout(undefined, "create")).toBeUndefined();
    expect(resolveContentFormLayout({}, "edit")).toBeUndefined();
  });

  it("uses one shared layout for both actions", () => {
    expect(resolveContentFormLayout({ layout: shared }, "create")).toBe(shared);
    expect(resolveContentFormLayout({ layout: shared }, "edit")).toBe(shared);
  });

  it("lets one action override the shared layout", () => {
    const forms = { create: { layout: createOnly }, layout: shared };

    expect(resolveContentFormLayout(forms, "create")).toBe(createOnly);
    expect(resolveContentFormLayout(forms, "edit")).toBe(shared);
  });

  it("takes per-action layouts with no shared fallback", () => {
    const forms = {
      create: { layout: createOnly },
      edit: { layout: editOnly },
    };

    expect(resolveContentFormLayout(forms, "create")).toBe(createOnly);
    expect(resolveContentFormLayout(forms, "edit")).toBe(editOnly);
  });
});
