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
    kind: field.enum({ values: ["forum", "blog"], nullable: true }),
    secret: field.number({ integer: true, nullable: true }),
  },
  publicApi: { path: "boards", fields: ["color", "kind"] },
});

const thread = <TRequired extends boolean>(required: TRequired) =>
  defineContentType({
    id: "test.thread",
    tableName: "test_threads",
    fields: {
      title: field.text({ required: true }),
      board: field.container({ definition: boards, required }),
    },
  });

describe("defineContentContainer", () => {
  it("infers the metadata and limits the public half to publicApi.fields", () => {
    expectTypeOf<
      ContentContainerRecord<typeof boards>["metadata"]
    >().toEqualTypeOf<
      Readonly<{
        color: null | string;
        kind: "blog" | "forum" | null;
        secret: null | number;
      }>
    >();
    expectTypeOf<
      ContentContainerPublicRecord<typeof boards>["metadata"]
    >().toEqualTypeOf<
      Readonly<{ color: null | string; kind: "blog" | "forum" | null }>
    >();
  });

  it("rejects a public field the definition does not declare", () => {
    defineContentContainer({
      id: "test.boards",
      fields: { color: field.text({ nullable: true }) },
      // @ts-expect-error - "nope" is not a field
      publicApi: { path: "boards", fields: ["nope"] },
    });
  });

  it("types a container field on create by its requiredness", () => {
    expectTypeOf<
      ContentCreateInput<ReturnType<typeof thread<true>>>
    >().toEqualTypeOf<{ board: number; title: string }>();
    expectTypeOf<
      ContentCreateInput<ReturnType<typeof thread<false>>>
    >().toEqualTypeOf<{ board?: null | number; title: string }>();
  });
});
