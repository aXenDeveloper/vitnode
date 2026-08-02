import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type {
  ContentCreateInput,
  ContentSelect,
  ContentUpdateInput,
  HasColumnDefault,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Article = typeof testArticleContentType;
type Select = ContentSelect<Article>;
type Create = ContentCreateInput<Article>;
type Update = ContentUpdateInput<Article>;

describe("content type inference", () => {
  it("keeps the content type id literal", () => {
    expectTypeOf(testArticleContentType.id).toEqualTypeOf<"test.article">();
    expectTypeOf(testCategoryContentType.id).toEqualTypeOf<"test.category">();
  });

  describe("select output", () => {
    it("adds the system columns", () => {
      expectTypeOf<Select["id"]>().toEqualTypeOf<number>();
      expectTypeOf<Select["createdAt"]>().toEqualTypeOf<Date>();
      expectTypeOf<Select["updatedAt"]>().toEqualTypeOf<Date>();
    });

    it("narrows enums to their literal union", () => {
      expectTypeOf<Select["status"]>().toEqualTypeOf<
        "archived" | "draft" | "published"
      >();
    });

    it("distinguishes nullable from non-nullable", () => {
      expectTypeOf<Select["title"]>().toEqualTypeOf<string>();
      expectTypeOf<Select["excerpt"]>().toEqualTypeOf<null | string>();
      expectTypeOf<Select["publishedAt"]>().toEqualTypeOf<Date | null>();
      expectTypeOf<Select["author"]>().toEqualTypeOf<null | number>();
    });

    it("types relation and user values as row identifiers", () => {
      expectTypeOf<Select["category"]>().toEqualTypeOf<number>();
    });
  });

  describe("create input", () => {
    it("excludes the generated system fields", () => {
      expectTypeOf<Create>().not.toHaveProperty("id");
      expectTypeOf<Create>().not.toHaveProperty("createdAt");
      expectTypeOf<Create>().not.toHaveProperty("updatedAt");
    });

    it("requires only the fields marked required", () => {
      expectTypeOf<keyof Create>().toEqualTypeOf<
        | "author"
        | "category"
        | "excerpt"
        | "featured"
        | "publishedAt"
        | "status"
        | "title"
        | "views"
      >();

      assertType<Create>({ title: "Hello", category: 1 });
      // @ts-expect-error - `title` is required
      assertType<Create>({ category: 1 });
      // @ts-expect-error - `category` is required
      assertType<Create>({ title: "Hello" });
    });

    it("serializes dateTime as an ISO string on the way in", () => {
      expectTypeOf<Create["publishedAt"]>().toEqualTypeOf<
        null | string | undefined
      >();
    });

    it("rejects a value outside the enum", () => {
      // @ts-expect-error - "nope" is not a declared status
      assertType<Create>({ title: "Hello", category: 1, status: "nope" });
    });

    it("rejects a wrong primitive type", () => {
      // @ts-expect-error - `views` is a number
      assertType<Create>({ title: "Hello", category: 1, views: "many" });
    });

    it("rejects null for a non-nullable field", () => {
      // @ts-expect-error - `title` is not nullable
      assertType<Create>({ title: null, category: 1 });
    });
  });

  describe("update input", () => {
    it("makes every editable field optional", () => {
      assertType<Update>({});
      assertType<Update>({ title: "Only the title" });
    });

    it("still rejects unknown and wrong-typed fields", () => {
      // @ts-expect-error - `slug` is not a field
      assertType<Update>({ slug: "nope" });
      // @ts-expect-error - `featured` is a boolean
      assertType<Update>({ featured: "yes" });
    });
  });

  describe("reserved fields", () => {
    it("cannot be declared", () => {
      defineContentType({
        id: "test.reserved",
        tableName: "test_reserved",
        fields: {
          title: field.text({ required: true }),
          // @ts-expect-error - `id` is a reserved system column
          id: field.number({ integer: true, required: true }),
        },
        admin: { label: { plural: "Reserved", singular: "Reserved" } },
      });
    });
  });

  describe("field builders", () => {
    it("defaults required and nullable to false", () => {
      const plain = field.text({ defaultValue: "" });
      expectTypeOf(plain.required).toEqualTypeOf<false>();
      expectTypeOf(plain.nullable).toEqualTypeOf<false>();
    });

    it("keeps required and nullable literal when set", () => {
      const both = field.text({ required: true, nullable: true });
      expectTypeOf(both.required).toEqualTypeOf<true>();
      expectTypeOf(both.nullable).toEqualTypeOf<true>();
    });

    it("keeps enum values as a readonly literal tuple", () => {
      const status = field.enum({ values: ["draft", "published"] });
      expectTypeOf(status.values).toEqualTypeOf<
        readonly ["draft", "published"]
      >();
    });

    it("keeps the declared default literal, so `hasDefault` is knowable", () => {
      expectTypeOf(
        field.enum({ values: ["draft", "published"], defaultValue: "draft" })
          .defaultValue,
      ).toEqualTypeOf<"draft">();
      expectTypeOf(
        field.enum({ values: ["draft", "published"] }).defaultValue,
      ).toEqualTypeOf<undefined>();
    });
  });

  describe("column defaults", () => {
    type Fields = (typeof testArticleContentType)["fields"];

    it("marks declared defaults", () => {
      expectTypeOf<HasColumnDefault<Fields["status"]>>().toEqualTypeOf<true>();
      expectTypeOf<HasColumnDefault<Fields["views"]>>().toEqualTypeOf<true>();
      expectTypeOf<
        HasColumnDefault<Fields["featured"]>
      >().toEqualTypeOf<true>();
    });

    it("leaves undefaulted fields alone", () => {
      expectTypeOf<HasColumnDefault<Fields["title"]>>().toEqualTypeOf<false>();
      expectTypeOf<
        HasColumnDefault<Fields["publishedAt"]>
      >().toEqualTypeOf<false>();
      expectTypeOf<HasColumnDefault<Fields["author"]>>().toEqualTypeOf<false>();
    });
  });
});
