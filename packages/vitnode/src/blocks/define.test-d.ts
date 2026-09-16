import type { z } from "zod";

import { describe, expectTypeOf, it } from "vitest";

import type {
  AnyBlockDefinition,
  AnyBlockInstance,
  BlockData,
  BlockDefinition,
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

describe("field.blocks", () => {
  it("reads back as an ordered list of instances", () => {
    expectTypeOf<
      z.output<typeof pageContentType.schemas.select>["content"]
    >().toEqualTypeOf<AnyBlockInstance[]>();
  });

  it("keeps the allowlist as literals", () => {
    expectTypeOf(pageContentType.fields.content.allowed).toEqualTypeOf<
      readonly ["core:hero"]
    >();
  });
});
