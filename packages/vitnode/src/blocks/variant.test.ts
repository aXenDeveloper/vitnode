// @vitest-environment node
import { describe, expect, it } from "vitest";

import { field } from "../content/fields";
import { defineBlock } from "./define";
import {
  blockVariantLabel,
  blockVariants,
  findBlockVariant,
  hasBlockVariants,
  resolveBlockVariant,
} from "./variant";

const Noop = () => null;

const withVariants = defineBlock({
  component: Noop,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "cards",
  variants: [
    { id: "grid", label: "Grid" },
    { description: "One card, twice the size", id: "featured" },
    { id: "side-by-side" },
  ],
});

const withoutDefault = defineBlock({
  component: Noop,
  fields: { title: field.text({ required: true }) },
  id: "quote",
  variants: [{ id: "plain" }, { id: "pulled" }],
});

const plain = defineBlock({
  component: Noop,
  fields: { title: field.text({ required: true }) },
  id: "text",
});

describe("blockVariants", () => {
  it("is empty for a block that declares none", () => {
    expect(blockVariants(plain)).toStrictEqual([]);
    expect(hasBlockVariants(plain)).toBe(false);
  });

  it("keeps the order the block declared", () => {
    expect(
      blockVariants(withVariants).map(variant => variant.id),
    ).toStrictEqual(["grid", "featured", "side-by-side"]);
    expect(hasBlockVariants(withVariants)).toBe(true);
  });
});

describe("findBlockVariant", () => {
  it("returns the declaration, description and all", () => {
    expect(findBlockVariant(withVariants, "featured")?.description).toBe(
      "One card, twice the size",
    );
  });

  it("returns nothing for an id the block does not declare", () => {
    expect(findBlockVariant(withVariants, "carousel")).toBeUndefined();
    expect(findBlockVariant(plain, "grid")).toBeUndefined();
  });
});

describe("resolveBlockVariant", () => {
  it("falls back to the default for a record saved before the variant existed", () => {
    expect(resolveBlockVariant(withVariants, undefined)).toStrictEqual({
      kind: "resolved",
      variant: "grid",
    });
  });

  it("leaves a legacy record alone when the block has no default", () => {
    expect(resolveBlockVariant(withoutDefault, undefined)).toStrictEqual({
      kind: "resolved",
      variant: undefined,
    });

    expect(resolveBlockVariant(plain, undefined)).toStrictEqual({
      kind: "resolved",
      variant: undefined,
    });
  });

  it("keeps an explicit variant the block declares", () => {
    expect(resolveBlockVariant(withVariants, "featured")).toStrictEqual({
      kind: "resolved",
      variant: "featured",
    });
  });

  it("never quietly swaps an unknown variant for the default", () => {
    expect(resolveBlockVariant(withVariants, "carousel")).toStrictEqual({
      kind: "unknown",
      variant: "carousel",
    });
  });

  it("reports a variant on a block that offers none", () => {
    expect(resolveBlockVariant(plain, "grid")).toStrictEqual({
      kind: "unknown",
      variant: "grid",
    });
  });
});

describe("blockVariantLabel", () => {
  it("prefers the label the plugin wrote", () => {
    expect(blockVariantLabel({ id: "grid", label: "Grid of cards" })).toBe(
      "Grid of cards",
    );
  });

  it("humanises the id when there is none", () => {
    expect(blockVariantLabel({ id: "side-by-side" })).toBe("Side by side");
    expect(blockVariantLabel({ id: "featured" })).toBe("Featured");
  });
});
