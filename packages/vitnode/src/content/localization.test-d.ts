import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testEditorialNoteContentType,
  testEditorialPostContentType,
  testLocalizedArticleContentType,
  testLocalizedNoteContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentLocalizedFieldName,
  ContentLocalizedUpdateValues,
  ContentLocalizedValues,
  ContentSelect,
  ContentSharedFieldName,
  ContentSharedValues,
  ContentUpdateInput,
  LocalizedContentTypeDefinition,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Localized = typeof testLocalizedArticleContentType;
type LocalizedNote = typeof testLocalizedNoteContentType;
type Article = typeof testArticleContentType;
type Post = typeof testPostContentType;

describe("localization", () => {
  // A tenth type parameter on `ContentTypeDefinition`, and this is what says it
  // costs nothing: the erased form every relation thunk, registry and route
  // builder is written against still accepts every concrete definition.
  describe("assignability to AnyContentTypeDefinition", () => {
    it("holds for a localized content type", () => {
      expectTypeOf<Localized>().toExtend<AnyContentTypeDefinition>();
      assertType<AnyContentTypeDefinition>(testLocalizedArticleContentType);
      assertType<AnyContentTypeDefinition>(testLocalizedNoteContentType);
    });

    it("still holds for every Stage 1-4 fixture", () => {
      assertType<AnyContentTypeDefinition>(testCategoryContentType);
      assertType<AnyContentTypeDefinition>(testArticleContentType);
      assertType<AnyContentTypeDefinition>(testPostContentType);
      assertType<AnyContentTypeDefinition>(testSearchablePostContentType);
      assertType<AnyContentTypeDefinition>(testEditorialPostContentType);
      assertType<AnyContentTypeDefinition>(testEditorialNoteContentType);
    });
  });

  describe("the flag stays literal", () => {
    it("is `true` when opted in", () => {
      expectTypeOf(
        testLocalizedArticleContentType.localization.enabled,
      ).toEqualTypeOf<true>();
    });

    it("is `false` when omitted", () => {
      expectTypeOf(
        testArticleContentType.localization.enabled,
      ).toEqualTypeOf<false>();
    });

    it("is `false` when written out explicitly", () => {
      const explicit = defineContentType({
        id: "test.explicit",
        tableName: "test_explicits",
        localization: { enabled: false },
        fields: { title: field.text({ required: true }) },
      });

      expectTypeOf(explicit.localization.enabled).toEqualTypeOf<false>();
    });

    // `enabled: true` and `enabled: false` staying distinguishable is what lets
    // Stage 5B-5D expose translation services, routes and AdminCP tabs
    // conditionally instead of at runtime.
    it("separates the two through LocalizedContentTypeDefinition", () => {
      expectTypeOf<Localized>().toExtend<LocalizedContentTypeDefinition>();
      expectTypeOf<Article>().not.toExtend<LocalizedContentTypeDefinition>();
      expectTypeOf<Post>().not.toExtend<LocalizedContentTypeDefinition>();
    });
  });

  describe("field-level `localized`", () => {
    it("keeps the literal on a text field", () => {
      expectTypeOf(
        testLocalizedArticleContentType.fields.title.localized,
      ).toEqualTypeOf<true>();
    });

    it("keeps the literal on a textarea field", () => {
      expectTypeOf(
        testLocalizedArticleContentType.fields.body.localized,
      ).toEqualTypeOf<true>();
    });

    it("keeps the literal on a slug field", () => {
      expectTypeOf(
        testLocalizedArticleContentType.fields.slug.localized,
      ).toEqualTypeOf<true>();
    });

    it("defaults to `false` rather than widening to boolean", () => {
      // A localizable field always carries the literal, so `localized: false`
      // and `localized: true` stay distinguishable. `?? false` alone would widen
      // it back to `boolean` and every partition would resolve to "shared".
      expectTypeOf(
        testArticleContentType.fields.title.localized,
      ).toEqualTypeOf<false>();
      expectTypeOf(
        testArticleContentType.fields.excerpt.localized,
      ).toEqualTypeOf<false>();
    });

    it("leaves the flag off a kind that cannot carry one", () => {
      // Inherited from `ContentFieldShared` and never written, so it is
      // `boolean | undefined` - which does not extend `true`, which is what puts
      // the field in the shared half.
      expectTypeOf(
        testLocalizedArticleContentType.fields.featured.localized,
      ).toEqualTypeOf<boolean | undefined>();
    });

    it("refuses `localized` on the kinds that cannot hold a translation", () => {
      // @ts-expect-error - a per-locale `true` is not a translation.
      field.boolean({ localized: true });
      // @ts-expect-error - a number means the same thing in every language.
      field.number({ integer: true, localized: true });
      // @ts-expect-error - a date is an instant, not prose.
      field.dateTime({ localized: true });
      // @ts-expect-error - enum identifiers have to match across locales.
      field.enum({ localized: true, values: ["a", "b"] });
      // @ts-expect-error - a user is a foreign key.
      field.user({ localized: true });
      field.relation({
        // @ts-expect-error - per-locale relations are out of scope.
        localized: true,
        target: () => testCategoryContentType,
      });
    });
  });

  describe("field-name partitions", () => {
    it("names the localized fields", () => {
      expectTypeOf<ContentLocalizedFieldName<Localized>>().toEqualTypeOf<
        "body" | "slug" | "title"
      >();
    });

    it("names the shared fields", () => {
      expectTypeOf<ContentSharedFieldName<Localized>>().toEqualTypeOf<
        "featured" | "views"
      >();
    });

    it("has no localized names for a non-localized content type", () => {
      expectTypeOf<ContentLocalizedFieldName<Article>>().toEqualTypeOf<never>();
      expectTypeOf<ContentSharedFieldName<Article>>().toEqualTypeOf<
        | "author"
        | "category"
        | "excerpt"
        | "featured"
        | "publishedAt"
        | "status"
        | "title"
        | "views"
      >();
    });
  });

  describe("shared values", () => {
    it("carry the base-table fields and nothing else", () => {
      expectTypeOf<ContentSharedValues<Localized>>().toEqualTypeOf<{
        featured?: boolean;
        views?: number;
      }>();
    });

    it("are what `create` accepts", () => {
      expectTypeOf<ContentCreateInput<Localized>>().toEqualTypeOf<
        ContentSharedValues<Localized>
      >();
    });

    it("are what a base row comes back as", () => {
      expectTypeOf<ContentSelect<Localized>>().toEqualTypeOf<{
        createdAt: Date;
        featured: boolean;
        id: number;
        updatedAt: Date;
        views: number;
      }>();
    });

    it("leave a non-localized content type's create input alone", () => {
      // Every field of a Stage 1 content type is shared, so nothing moved.
      expectTypeOf<ContentCreateInput<Article>>().toEqualTypeOf<{
        author?: null | number;
        category: number;
        excerpt?: null | string;
        featured?: boolean;
        publishedAt?: null | string;
        status?: "archived" | "draft" | "published";
        title: string;
        views?: number;
      }>();
    });
  });

  describe("localized values", () => {
    it("preserve requiredness, nullability and derived slugs", () => {
      expectTypeOf<ContentLocalizedValues<Localized>>().toEqualTypeOf<{
        body?: null | string;
        // Sourced from the title, so it is derivable and therefore optional.
        slug?: string;
        title: string;
      }>();
    });

    it("require a sourceless slug", () => {
      expectTypeOf<ContentLocalizedValues<LocalizedNote>>().toEqualTypeOf<{
        heading: string;
        slug: string;
      }>();
    });

    it("make every key optional on update", () => {
      expectTypeOf<ContentLocalizedUpdateValues<Localized>>().toEqualTypeOf<{
        body?: null | string;
        slug?: string;
        title?: string;
      }>();
    });

    // The one thing that makes `translation:` impossible to fill in by accident
    // on a Stage 1-4 definition.
    it("are empty for a non-localized content type", () => {
      expectTypeOf<
        keyof ContentLocalizedValues<Article>
      >().toEqualTypeOf<never>();
      expectTypeOf<keyof ContentLocalizedValues<Post>>().toEqualTypeOf<never>();
    });

    it("keep localized fields out of the base update input", () => {
      expectTypeOf<keyof ContentUpdateInput<Localized>>().toEqualTypeOf<
        "featured" | "views"
      >();
    });
  });

  describe("admin config separates showing a value from querying one", () => {
    it("accepts a localized field as a list column", () => {
      // A cell renders whatever the reader's own translation holds. It is a
      // projection, not a column on the base table - so it is allowed here and
      // still refused everywhere a query would address it.
      defineContentType({
        id: "test.localizedcolumn",
        tableName: "test_localized_columns",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          featured: field.boolean({ defaultValue: false }),
        },
        admin: {
          list: { columns: ["title"] },
        },
      });
    });

    it("accepts a localized field as the title field", () => {
      defineContentType({
        id: "test.localizedtitle",
        tableName: "test_localized_titles",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          featured: field.boolean({ defaultValue: false }),
        },
        admin: {
          titleField: "title",
        },
      });
    });

    it("still rejects a localized field as an orderable one", () => {
      defineContentType({
        id: "test.badorder",
        tableName: "test_bad_orders",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          featured: field.boolean({ defaultValue: false }),
        },
        admin: {
          // @ts-expect-error - `orderBy` is SQL on the base table.
          list: { orderableFields: ["title"] },
        },
      });
    });

    it("still rejects a localized field as a searchable one", () => {
      defineContentType({
        id: "test.badsearch",
        tableName: "test_bad_searches",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          featured: field.boolean({ defaultValue: false }),
        },
        admin: {
          // @ts-expect-error - an admin list search is a predicate on the row.
          list: { searchableFields: ["title"] },
        },
      });
    });

    it("rejects a localized field in an index", () => {
      defineContentType({
        id: "test.badindex",
        tableName: "test_bad_indexes",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          featured: field.boolean({ defaultValue: false }),
        },
        // @ts-expect-error - the base table has no `title` column to index.
        indexes: [{ on: ["title"] }],
      });
    });

    it("still accepts a shared field everywhere", () => {
      expectTypeOf(
        testLocalizedArticleContentType.admin.list.columns,
      ).toEqualTypeOf<string[]>();
    });
  });
});
