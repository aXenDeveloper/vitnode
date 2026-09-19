import {
  resolveWidgetVariant,
  widgetDataShapeIssue,
  widgetVariantLabel,
} from "@vitnode/core/widgets";
import { createBlockInstanceFor } from "@vitnode/core/editor/instance/defaults";
import { describe, expect, it } from "vitest";

import { featuresWidget } from "./features";

const registered = {
  definition: featuresWidget,
  namespace: "example",
  pluginId: "@vitnode/example",
  type: "example:features",
};

describe("featuresWidget", () => {
  it("is renderable and saveable the moment the editor adds it", () => {
    const instance = createBlockInstanceFor(registered);

    expect(instance.type).toBe("example:features");
    expect(widgetDataShapeIssue(featuresWidget, instance.data)).toBeNull();
  });

  it("offers three variants, each with a label of its own", () => {
    expect(featuresWidget.variants?.map(variant => variant.id)).toStrictEqual([
      "grid",
      "list",
      "compact",
    ]);
    expect(featuresWidget.variants?.map(widgetVariantLabel)).toStrictEqual([
      "Grid",
      "List",
      "Compact",
    ]);
  });

  it("falls back to the grid it declares as the default", () => {
    expect(featuresWidget.defaultVariant).toBe("grid");
    expect(resolveWidgetVariant(featuresWidget, undefined)).toStrictEqual({
      kind: "resolved",
      variant: "grid",
    });
  });

  it("resolves every variant it declares and refuses one it does not", () => {
    for (const variant of featuresWidget.variants ?? []) {
      expect(resolveWidgetVariant(featuresWidget, variant.id)).toStrictEqual({
        kind: "resolved",
        variant: variant.id,
      });
    }

    expect(resolveWidgetVariant(featuresWidget, "carousel")).toStrictEqual({
      kind: "unknown",
      variant: "carousel",
    });
  });

  it("keeps its items in fields a block may hold, rather than a repeatable", () => {
    expect(Object.keys(featuresWidget.fields)).toStrictEqual([
      "heading",
      "intro",
      "primary",
      "secondary",
      "tertiary",
    ]);

    for (const name of ["primary", "secondary", "tertiary"]) {
      expect(featuresWidget.fields[name].kind).toBe("group");
    }
  });

  it("keeps the variant out of its data, because presentation is not content", () => {
    const { data } = createBlockInstanceFor(registered);

    expect(Object.keys(data)).not.toContain("variant");
    expect(widgetDataShapeIssue(featuresWidget, data)).toBeNull();
    expect(
      widgetDataShapeIssue(featuresWidget, { ...data, variant: "grid" }),
    ).not.toBeNull();
  });
});
