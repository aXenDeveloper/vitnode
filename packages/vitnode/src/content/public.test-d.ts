import { assertType, describe, expectTypeOf, it } from "vitest";

import type { testArticleContentType } from "@/tests/content-fixtures";

import {
  testCategoryContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import type {
  ContentPublicReadOptions,
  ContentPublicService,
} from "./server/public-service";
import type {
  AnyContentTypeDefinition,
  ContentPublicFieldName,
  ContentPublicFilterInput,
  ContentPublicListRow,
  ContentPublicRelation,
  ContentPublicSelect,
  PublicContentTypeDefinition,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";
import { contentPublicFetch } from "./next/fetch.server";

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

    it("projects a relation down to an identifier", () => {
      // `category` is required, so it is never null - and it is never the
      // related row either.
      expectTypeOf<
        ContentPublicSelect<Post>["category"]
      >().toEqualTypeOf<ContentPublicRelation>();
      expectTypeOf<ContentPublicRelation>().toEqualTypeOf<{ id: number }>();
    });

    it("puts no label on a relation", () => {
      // `admin.titleField` is administrative metadata. Reading it through
      // somebody else's allowlist is not a decision this projection makes.
      expectTypeOf<ContentPublicRelation>().not.toHaveProperty("label");
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

  describe("the public service", () => {
    type Service = ContentPublicService<Post>;

    it("reads three ways and writes none", () => {
      expectTypeOf<keyof Service>().toEqualTypeOf<
        "findById" | "findBySlug" | "findMany"
      >();
    });

    it("resolves a single row to the public projection", () => {
      // `findById` is direct-plugin API - an event listener holding a
      // `contentId` should not have to look a slug up first. No numeric-id
      // *route* is generated; the detail URL is the slug.
      expectTypeOf<
        Awaited<ReturnType<Service["findById"]>>
      >().toEqualTypeOf<ContentPublicSelect<Post> | null>();
      expectTypeOf<
        Awaited<ReturnType<Service["findBySlug"]>>
      >().toEqualTypeOf<ContentPublicSelect<Post> | null>();
    });

    it("takes no predicate argument on either lookup", () => {
      // The published condition is applied inside every method. There is no
      // parameter a caller could pass to widen it - the optional second one
      // names a *language*, which chooses which translation the predicate runs
      // against and can never relax it.
      expectTypeOf<Service["findById"]>().parameters.toEqualTypeOf<
        [number, ContentPublicReadOptions?]
      >();
      expectTypeOf<Service["findBySlug"]>().parameters.toEqualTypeOf<
        [string, ContentPublicReadOptions?]
      >();
    });

    it("lists the public projection too", () => {
      expectTypeOf<
        Awaited<ReturnType<Service["findMany"]>>["edges"]
      >().toEqualTypeOf<ContentPublicListRow<Post>[]>();
    });
  });

  describe("PublicContentTypeDefinition", () => {
    it("is satisfied by a content type with a public API", () => {
      expectTypeOf<Post>().toExtend<PublicContentTypeDefinition>();
    });

    it("is not satisfied without one", () => {
      expectTypeOf<Category>().not.toExtend<PublicContentTypeDefinition>();
      expectTypeOf<Article>().not.toExtend<PublicContentTypeDefinition>();
    });

    it("is still an AnyContentTypeDefinition", () => {
      // Narrowing one flag must not cost the erased form everything else takes.
      expectTypeOf<PublicContentTypeDefinition>().toExtend<AnyContentTypeDefinition>();
    });
  });
});

describe("contentPublicFetch", () => {
  it("accepts a content type with a public API", () => {
    void contentPublicFetch({
      definition: testPostContentType,
      pluginId: "@vitnode/example",
    });
  });

  it("rejects one without", () => {
    // A disabled `publicApi` has an empty `path`, so this would request
    // `/api/@vitnode/example/content//` - a compile error, not a runtime one.
    void contentPublicFetch({
      // @ts-expect-error - no public API
      definition: testCategoryContentType,
      pluginId: "@vitnode/example",
    });
  });
});
