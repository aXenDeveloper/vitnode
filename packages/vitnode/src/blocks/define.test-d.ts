import type { z } from "zod";

import { describe, expectTypeOf, it } from "vitest";

import type {
  AnyBlockDefinition,
  BlockData,
  BlockDefinition,
  BlockVariantDefinition,
  ContentNode,
} from "./types";

import { defineContentType } from "../content/define";
import { field } from "../content/fields";
import { defineBlock } from "./define";
import { parseBlockData } from "./schema";

const heroFields = {
  description: field.textarea({ nullable: true }),
  title: field.text({ required: true }),
  variant: field.enum({
    defaultValue: "default",
    values: ["default", "centered"],
  }),
};

const heroBlock = defineBlock({
  component: ({ data }) => data.title,
  fields: heroFields,
  id: "hero",
});

const pageContentType = defineContentType({
  id: "test.page",
  tableName: "test_type_pages",
  fields: {
    content: field.blocks({ allowed: ["core:hero"] }),
    title: field.text({ required: true }),
  },
});

describe("BlockData", () => {
  it("keeps a required field required", () => {
    expectTypeOf<
      BlockData<typeof heroFields>["title"]
    >().toEqualTypeOf<string>();
  });

  it("makes a defaulted field optional and keeps its literals", () => {
    expectTypeOf<BlockData<typeof heroFields>["variant"]>().toEqualTypeOf<
      "centered" | "default" | undefined
    >();
  });

  it("keeps a nullable field nullable", () => {
    expectTypeOf<BlockData<typeof heroFields>["description"]>().toEqualTypeOf<
      null | string | undefined
    >();
  });
});

describe("defineBlock", () => {
  it("carries the id as a literal", () => {
    expectTypeOf(heroBlock.id).toEqualTypeOf<"hero">();
  });

  it("keeps the field map, so the data type is recoverable from the definition", () => {
    expectTypeOf(heroBlock.fields).toEqualTypeOf<typeof heroFields>();
  });

  it("types `parseBlockData` by the definition's field map", () => {
    expectTypeOf(parseBlockData(heroBlock, {})).toEqualTypeOf<
      BlockData<typeof heroFields>
    >();
  });

  it("stays assignable to the erased definition a registry holds", () => {
    expectTypeOf<
      BlockDefinition<"hero", typeof heroFields>
    >().toExtend<AnyBlockDefinition>();
  });
});

const cardsBlock = defineBlock({
  component: ({ data }) => data.title,
  defaultVariant: "grid",
  fields: { title: field.text({ required: true }) },
  id: "cards",
  variants: [{ id: "grid" }, { id: "featured" }] as const,
});

const quoteBlock = defineBlock({
  component: ({ data }) => data.title,
  fields: { title: field.text({ required: true }) },
  id: "quote",
});

describe("defineBlock variants", () => {
  it("narrows the default to the declared ids", () => {
    expectTypeOf(cardsBlock.defaultVariant).toEqualTypeOf<
      "featured" | "grid" | undefined
    >();
  });

  it("refuses a default the block does not declare", () => {
    defineBlock({
      component: ({ data }) => data.title,
      // @ts-expect-error "carousel" is not one of the declared variants.
      defaultVariant: "carousel",
      fields: { title: field.text({ required: true }) },
      id: "cards",
      variants: [{ id: "grid" }, { id: "featured" }] as const,
    });
  });

  it("refuses a default on a block that declares none", () => {
    defineBlock({
      component: ({ data }) => data.title,
      // @ts-expect-error a default needs variants to pick from.
      defaultVariant: "grid",
      fields: { title: field.text({ required: true }) },
      id: "quote",
    });
  });

  it("leaves a block with no variants carrying none", () => {
    expectTypeOf(quoteBlock.variants).toEqualTypeOf<
      readonly BlockVariantDefinition<never>[] | undefined
    >();
  });

  it("stays assignable to the erased definition a registry holds", () => {
    expectTypeOf(cardsBlock).toExtend<AnyBlockDefinition>();
    expectTypeOf(quoteBlock).toExtend<AnyBlockDefinition>();
  });
});

describe("field.blocks", () => {
  it("reads back as an ordered list of content nodes", () => {
    expectTypeOf<
      z.output<typeof pageContentType.schemas.select>["content"]
    >().toEqualTypeOf<ContentNode[]>();
  });

  it("keeps the allowlist as literals", () => {
    expectTypeOf(pageContentType.fields.content.allowed).toEqualTypeOf<
      readonly ["core:hero"]
    >();
  });
});
