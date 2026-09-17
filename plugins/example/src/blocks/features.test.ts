import {
  blockDataShapeIssue,
  blockVariantLabel,
  resolveBlockVariant,
} from "@vitnode/core/blocks";
import { createBlockInstanceFor } from "@vitnode/core/editor/instance/defaults";
import { describe, expect, it } from "vitest";

import { featuresBlock } from "./features";

const registered = {
  definition: featuresBlock,
  namespace: "example",
  pluginId: "@vitnode/example",
  type: "example:features",
};

describe("featuresBlock", () => {
  it("is renderable and saveable the moment the editor adds it", () => {
    const instance = createBlockInstanceFor(registered);

    expect(instance.type).toBe("example:features");
    expect(blockDataShapeIssue(featuresBlock, instance.data)).toBeNull();
  });

  it("offers three variants, each with a label of its own", () => {
    expect(featuresBlock.variants?.map(variant => variant.id)).toStrictEqual([
      "grid",
      "list",
      "compact",
    ]);
    expect(featuresBlock.variants?.map(blockVariantLabel)).toStrictEqual([
      "Grid",
      "List",
      "Compact",
    ]);
  });

  it("falls back to the grid it declares as the default", () => {
    expect(featuresBlock.defaultVariant).toBe("grid");
    expect(resolveBlockVariant(featuresBlock, undefined)).toStrictEqual({
      kind: "resolved",
      variant: "grid",
    });
  });

  it("resolves every variant it declares and refuses one it does not", () => {
    for (const variant of featuresBlock.variants ?? []) {
      expect(resolveBlockVariant(featuresBlock, variant.id)).toStrictEqual({
        kind: "resolved",
        variant: variant.id,
      });
    }

    expect(resolveBlockVariant(featuresBlock, "carousel")).toStrictEqual({
      kind: "unknown",
      variant: "carousel",
    });
  });

  it("keeps its items in fields a block may hold, rather than a repeatable", () => {
    expect(Object.keys(featuresBlock.fields)).toStrictEqual([
      "heading",
      "intro",
      "primary",
      "secondary",
      "tertiary",
    ]);

    for (const name of ["primary", "secondary", "tertiary"]) {
      expect(featuresBlock.fields[name].kind).toBe("group");
    }
  });

  it("keeps the variant out of its data, because presentation is not content", () => {
    const { data } = createBlockInstanceFor(registered);

    expect(Object.keys(data)).not.toContain("variant");
    expect(blockDataShapeIssue(featuresBlock, data)).toBeNull();
    expect(
      blockDataShapeIssue(featuresBlock, { ...data, variant: "grid" }),
    ).not.toBeNull();
  });
});
