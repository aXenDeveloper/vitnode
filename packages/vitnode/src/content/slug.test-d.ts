import { assertType, describe, expectTypeOf, it } from "vitest";

import type { testPostContentType } from "@/tests/content-fixtures";

import type {
  ContentCreateInput,
  ContentFieldValue,
  ContentFilterInput,
  ContentSelect,
  ContentSlugField,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Post = typeof testPostContentType;

describe("field.slug", () => {
  describe("descriptor", () => {
    it("keeps the source literal", () => {
      const sourced = field.slug({ source: "title" });

      expectTypeOf(sourced.kind).toEqualTypeOf<"slug">();
      expectTypeOf(sourced.source).toEqualTypeOf<"title">();
    });

    it("is never nullable", () => {
      // Not an argument, and not inferable as `true` from anywhere: a row
      // without a URL segment cannot be addressed.
      expectTypeOf(field.slug().nullable).toEqualTypeOf<false>();
      expectTypeOf(
        field.slug({ source: "title" }).nullable,
      ).toEqualTypeOf<false>();
    });

    it("derives `required` from the source", () => {
      expectTypeOf(field.slug().required).toEqualTypeOf<true>();
      expectTypeOf(
        field.slug({ source: "title" }).required,
      ).toEqualTypeOf<false>();
    });

    it("takes no `required` argument", () => {
      // The two could otherwise contradict each other - "you must always send
      // it" alongside "derive it for me".
      // @ts-expect-error - `required` is a consequence of `source`
      field.slug({ required: true, source: "title" });
    });

    it("takes no `nullable` argument", () => {
      // @ts-expect-error - a slug is always NOT NULL
      field.slug({ nullable: true });
    });

    it("carries no default value", () => {
      // Nothing downstream should think a slug column has a database default.
      expectTypeOf<ContentSlugField>().not.toHaveProperty("defaultValue");
    });

    it("holds a string", () => {
      expectTypeOf<
        ContentFieldValue<ReturnType<typeof field.slug>>
      >().toEqualTypeOf<string>();
    });
  });

  describe("on a content type", () => {
    it("is a string in the response", () => {
      expectTypeOf<ContentSelect<Post>["slug"]>().toEqualTypeOf<string>();
    });

    it("is optional in create when it has a source", () => {
      assertType<ContentCreateInput<Post>>({ category: 1, title: "Hello" });
      assertType<ContentCreateInput<Post>>({
        category: 1,
        slug: "hello",
        title: "Hello",
      });
    });

    it("is required in create when it has none", () => {
      const manual = defineContentType({
        id: "test.manual-slug-type",
        tableName: "test_manual_slug_types",
        fields: {
          title: field.text({ required: true }),
          slug: field.slug(),
        },
      });

      expectTypeOf(manual.fields.slug.required).toEqualTypeOf<true>();
      assertType<ContentCreateInput<typeof manual>>({
        slug: "hello",
        title: "Hello",
      });
      // @ts-expect-error - nothing can derive this one
      assertType<ContentCreateInput<typeof manual>>({ title: "Hello" });
    });

    it("is optional in update, like every other field", () => {
      assertType<ContentUpdateInput<Post>>({ slug: "moved" });
    });

    it("is equality-filterable", () => {
      expectTypeOf<ContentFilterInput<Post>["slug"]>().toEqualTypeOf<
        string | undefined
      >();
    });

    it("rejects a non-string value", () => {
      assertType<ContentCreateInput<Post>>({
        category: 1,
        // @ts-expect-error - a slug is text
        slug: 12,
        title: "Hello",
      });
    });
  });
});
