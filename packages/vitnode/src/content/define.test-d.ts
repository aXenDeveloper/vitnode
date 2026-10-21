import { assertType, describe, expectTypeOf, it } from "vitest";

import { testArticleContentType } from "@/tests/content-fixtures";

import type {
  ContentCreateInput,
  ContentSelect,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Article = typeof testArticleContentType;
type Select = ContentSelect<Article>;
type Create = ContentCreateInput<Article>;
type Update = ContentUpdateInput<Article>;

describe("defineContentType inference", () => {
  it("keeps the content type id literal", () => {
    expectTypeOf(testArticleContentType.id).toEqualTypeOf<"test.article">();
  });

  it("infers the row from the fields", () => {
    expectTypeOf<Select["id"]>().toEqualTypeOf<number>();
    expectTypeOf<Select["createdAt"]>().toEqualTypeOf<Date>();
    expectTypeOf<Select["status"]>().toEqualTypeOf<
      "archived" | "draft" | "published"
    >();
    expectTypeOf<Select["title"]>().toEqualTypeOf<string>();
    expectTypeOf<Select["excerpt"]>().toEqualTypeOf<null | string>();
    expectTypeOf<Select["author"]>().toEqualTypeOf<null | number>();
    expectTypeOf<Select["category"]>().toEqualTypeOf<number>();
  });

  it("requires only the required fields on create and none on update", () => {
    expectTypeOf<Create>().not.toHaveProperty("id");
    expectTypeOf<Create["publishedAt"]>().toEqualTypeOf<
      null | string | undefined
    >();
    assertType<Create>({ title: "Hello", category: 1 });
    assertType<Update>({});
    // @ts-expect-error - `title` is required
    assertType<Create>({ category: 1 });
  });

  it("rejects wrong values on create and update", () => {
    // @ts-expect-error - "nope" is not a declared status
    assertType<Create>({ title: "Hello", category: 1, status: "nope" });
    // @ts-expect-error - `views` is a number
    assertType<Create>({ title: "Hello", category: 1, views: "many" });
    // @ts-expect-error - `title` is not nullable
    assertType<Create>({ title: null, category: 1 });
    // @ts-expect-error - `slug` is not a field
    assertType<Update>({ slug: "nope" });
  });

  it("rejects a reserved system column as a field", () => {
    defineContentType({
      id: "test.reserved",
      tableName: "test_reserved",
      fields: {
        title: field.text({ required: true }),
        // @ts-expect-error - `id` is a reserved system column
        id: field.number({ integer: true, required: true }),
      },
    });
  });

  it("refuses an unknown admin presentation mode", () => {
    defineContentType({
      id: "test.modes",
      tableName: "test_modes",
      fields: { title: field.text({ required: true }) },
      admin: {
        // @ts-expect-error - only "dialog" and "page" are presentation modes
        create: { mode: "drawer" },
      },
    });
  });
});

describe("content type options", () => {
  const fields = {
    title: field.text({ required: true }),
    slug: field.slug({ source: "title" }),
  };

  it("resolves `true`, options objects and omitted blocks to literal flags", () => {
    const enabled = defineContentType({
      id: "test.options",
      tableName: "test_options",
      fields,
      publication: true,
      publicApi: { path: "options", fields: ["title", "slug"] },
      editorial: { preview: true },
      delivery: true,
    });
    const bare = defineContentType({
      id: "test.bare",
      tableName: "test_bare",
      fields,
    });

    expectTypeOf(enabled.publication.enabled).toEqualTypeOf<true>();
    expectTypeOf(enabled.publicApi.enabled).toEqualTypeOf<true>();
    expectTypeOf(enabled.editorial.preview.enabled).toEqualTypeOf<true>();
    expectTypeOf(enabled.editorial.scheduling.enabled).toEqualTypeOf<false>();
    expectTypeOf(enabled.delivery.enabled).toEqualTypeOf<true>();
    expectTypeOf(bare.publication.enabled).toEqualTypeOf<false>();
    expectTypeOf(bare.editorial.enabled).toEqualTypeOf<false>();
  });

  it("accepts `liveEditing` only alongside `editorial`", () => {
    assertType(
      defineContentType({
        id: "test.live",
        tableName: "test_live",
        fields,
        editorial: true,
        liveEditing: true,
      }),
    );
    assertType(
      defineContentType({
        id: "test.live",
        tableName: "test_live",
        fields,
        // @ts-expect-error - live editing needs `editorial`
        liveEditing: true,
      }),
    );
  });

  it("rejects the removed `enabled` key", () => {
    assertType(
      defineContentType({
        id: "test.legacy",
        tableName: "test_legacy",
        fields,
        // @ts-expect-error - `publication` is `true` or `false`
        publication: { enabled: true },
      }),
    );
  });
});
