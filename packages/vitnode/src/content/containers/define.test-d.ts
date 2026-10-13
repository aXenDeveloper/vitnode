import { describe, expectTypeOf, it } from "vitest";

import type { ContentCreateInput } from "../types";
import type {
  ContentContainerPublicRecord,
  ContentContainerRecord,
} from "./types";

import { defineContentType } from "../define";
import { field } from "../fields";
import { defineContentContainer } from "./define";

const boards = defineContentContainer({
  id: "test.boards",
  fields: {
    color: field.text({ maxLength: 7, required: true }),
    locked: field.boolean({ defaultValue: false }),
    kind: field.enum({ values: ["forum", "blog"], nullable: true }),
    secret: field.number({ integer: true, nullable: true }),
  },
  publicApi: { path: "boards", fields: ["color", "kind"] },
});

const sections = defineContentContainer({ id: "test.sections" });

const thread = <TRequired extends boolean>(required: TRequired) =>
  defineContentType({
    id: "test.thread",
    tableName: "test_threads",
    fields: {
      title: field.text({ required: true }),
      board: field.container({ definition: boards, required }),
    },
  });

describe("content container types", () => {
  it("infers the metadata from the fields, every value nullable", () => {
    expectTypeOf<
      ContentContainerRecord<typeof boards>["metadata"]
    >().toEqualTypeOf<
      Readonly<{
        color: null | string;
        kind: "blog" | "forum" | null;
        locked: boolean | null;
        secret: null | number;
      }>
    >();
  });

  it("limits the public metadata to publicApi.fields", () => {
    expectTypeOf<
      ContentContainerPublicRecord<typeof boards>["metadata"]
    >().toEqualTypeOf<
      Readonly<{ color: null | string; kind: "blog" | "forum" | null }>
    >();
  });

  it("has no metadata for a definition without fields", () => {
    expectTypeOf<
      ContentContainerRecord<typeof sections>["metadata"]
    >().toEqualTypeOf<Record<never, never>>();
    expectTypeOf<
      ContentContainerPublicRecord<typeof sections>["metadata"]
    >().toEqualTypeOf<Record<never, never>>();
  });

  it("keeps the public API flag and path literal", () => {
    expectTypeOf(boards.publicApi.enabled).toEqualTypeOf<true>();
    expectTypeOf(boards.publicApi.path).toEqualTypeOf<"boards">();
    expectTypeOf(sections.publicApi.enabled).toEqualTypeOf<false>();
  });

  it("rejects a public field the definition does not declare", () => {
    defineContentContainer({
      id: "test.boards",
      fields: { color: field.text({ nullable: true }) },
      // @ts-expect-error - "nope" is not a field
      publicApi: { path: "boards", fields: ["nope"] },
    });
  });

  it("makes a required container a required number on create", () => {
    expectTypeOf<
      ContentCreateInput<ReturnType<typeof thread<true>>>
    >().toEqualTypeOf<{ board: number; title: string }>();
  });

  it("makes an optional container an optional number or null on create", () => {
    expectTypeOf<
      ContentCreateInput<ReturnType<typeof thread<false>>>
    >().toEqualTypeOf<{ board?: null | number; title: string }>();
  });
});
