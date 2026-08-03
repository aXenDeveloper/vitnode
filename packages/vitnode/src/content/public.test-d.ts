import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import { testPostContentType } from "@/tests/content-fixtures";

import type {
  AnyContentTypeDefinition,
  ContentPublicFieldName,
  ContentPublicFilterInput,
  ContentPublicListRow,
  ContentPublicRelation,
  ContentPublicSelect,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Post = typeof testPostContentType;
type Article = typeof testArticleContentType;
type Category = typeof testCategoryContentType;

describe("publicApi types", () => {
  // Adding two more type parameters to `ContentTypeDefinition` must not break
  // the erased form every relation thunk, registry and route builder uses.
  describe("assignability to AnyContentTypeDefinition", () => {
    it("holds for a public content type", () => {
      expectTypeOf<Post>().toExtend<AnyContentTypeDefinition>();
      assertType<AnyContentTypeDefinition>(testPostContentType);
    });

    it("still holds for a Stage 1 content type", () => {
      expectTypeOf<Article>().toExtend<AnyContentTypeDefinition>();
    });
  });

  describe("the enabled flag stays literal", () => {
    it("is `true` when opted in", () => {
      expectTypeOf(testPostContentType.publicApi.enabled).toEqualTypeOf<true>();
    });

    it("is `false` when omitted", () => {
      const private_ = defineContentType({
        id: "test.private-type",
        tableName: "test_private_types",
        fields: { title: field.text({ required: true }) },
        admin: { label: { plural: "Privates", singular: "Private" } },
      });

      expectTypeOf(private_.publicApi.enabled).toEqualTypeOf<false>();
    });
  });

  describe("field-name union", () => {
    it("is exactly the configured allowlist", () => {
      expectTypeOf<ContentPublicFieldName<Post>>().toEqualTypeOf<
        "category" | "excerpt" | "publishedAt" | "slug" | "title"
      >();
    });

    it("is empty without a public API", () => {
      expectTypeOf<ContentPublicFieldName<Category>>().toEqualTypeOf<never>();
    });
  });

  describe("projection", () => {
    it("has exactly the allowlisted keys", () => {
      expectTypeOf<keyof ContentPublicSelect<Post>>().toEqualTypeOf<
        "category" | "excerpt" | "publishedAt" | "slug" | "title"
      >();
    });

    it("omits every private field at compile time", () => {
      // The runtime counterpart lives in `public.test.ts` and the public
      // service tests - this is the half that stops the leak being written.
      expectTypeOf<ContentPublicSelect<Post>>().not.toHaveProperty("views");
      expectTypeOf<ContentPublicSelect<Post>>().not.toHaveProperty("author");
      expectTypeOf<ContentPublicSelect<Post>>().not.toHaveProperty("status");
      expectTypeOf<ContentPublicSelect<Post>>().not.toHaveProperty("id");
    });

    it("keeps declared value types", () => {
      expectTypeOf<
        ContentPublicSelect<Post>["title"]
      >().toEqualTypeOf<string>();
      expectTypeOf<ContentPublicSelect<Post>["slug"]>().toEqualTypeOf<string>();
      expectTypeOf<ContentPublicSelect<Post>["excerpt"]>().toEqualTypeOf<
        null | string
      >();
      expectTypeOf<
        ContentPublicSelect<Post>["publishedAt"]
      >().toEqualTypeOf<Date | null>();
    });

    it("projects a relation down to an id and a label", () => {
      // `category` is required, so it is never null - and it is never the
      // related row either.
      expectTypeOf<
        ContentPublicSelect<Post>["category"]
      >().toEqualTypeOf<ContentPublicRelation>();
      expectTypeOf<ContentPublicRelation>().toEqualTypeOf<{
        id: number;
        label: null | string;
      }>();
    });

    it("is the same shape for a list row", () => {
      expectTypeOf<ContentPublicListRow<Post>>().toEqualTypeOf<
        ContentPublicSelect<Post>
      >();
    });

    it("is empty for a content type with no public API", () => {
      expectTypeOf<
        keyof ContentPublicSelect<Category>
      >().toEqualTypeOf<never>();
    });
  });

  describe("filters", () => {
    it("accepts an exposed, filterable field", () => {
      assertType<ContentPublicFilterInput<Post>>({ category: 2 });
      assertType<ContentPublicFilterInput<Post>>({ title: "Hello" });
    });

    it("rejects a private field", () => {
      assertType<ContentPublicFilterInput<Post>>({
        // @ts-expect-error - `views` is not exposed publicly
        views: 10,
      });
      assertType<ContentPublicFilterInput<Post>>({
        // @ts-expect-error - `author` is not exposed publicly
        author: 1,
      });
    });

    it("rejects an exposed field of a non-filterable kind", () => {
      assertType<ContentPublicFilterInput<Post>>({
        // @ts-expect-error - a textarea has no equality filter
        excerpt: "prose",
      });
    });
  });
});
