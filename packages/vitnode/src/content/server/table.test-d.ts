import { describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentSelect } from "../types";

import { createContentTable } from "./table";

const categories = createContentTable(testCategoryContentType);

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- read as a type
const articles = createContentTable(testArticleContentType, {
  references: { category: () => categories.id },
});

type Select = (typeof articles)["$inferSelect"];
type Insert = (typeof articles)["$inferInsert"];

describe("createContentTable inference", () => {
  describe("$inferSelect", () => {
    it("matches the descriptor-derived row type", () => {
      expectTypeOf<Select>().toEqualTypeOf<
        ContentSelect<typeof testArticleContentType>
      >();
    });

    it("narrows enum columns", () => {
      expectTypeOf<Select["status"]>().toEqualTypeOf<
        "archived" | "draft" | "published"
      >();
    });

    it("keeps nullable columns nullable", () => {
      expectTypeOf<Select["excerpt"]>().toEqualTypeOf<null | string>();
      expectTypeOf<Select["publishedAt"]>().toEqualTypeOf<Date | null>();
      expectTypeOf<Select["author"]>().toEqualTypeOf<null | number>();
    });

    it("keeps non-nullable columns non-nullable", () => {
      expectTypeOf<Select["title"]>().toEqualTypeOf<string>();
      expectTypeOf<Select["views"]>().toEqualTypeOf<number>();
      expectTypeOf<Select["category"]>().toEqualTypeOf<number>();
      expectTypeOf<Select["createdAt"]>().toEqualTypeOf<Date>();
    });
  });

  describe("$inferInsert", () => {
    it("makes the generated system columns optional", () => {
      expectTypeOf<Insert["id"]>().toEqualTypeOf<number | undefined>();
      expectTypeOf<Insert["createdAt"]>().toEqualTypeOf<Date | undefined>();
      expectTypeOf<Insert["updatedAt"]>().toEqualTypeOf<Date | undefined>();
    });

    it("makes defaulted columns optional", () => {
      expectTypeOf<Insert["status"]>().toEqualTypeOf<
        "archived" | "draft" | "published" | undefined
      >();
      expectTypeOf<Insert["views"]>().toEqualTypeOf<number | undefined>();
      expectTypeOf<Insert["featured"]>().toEqualTypeOf<boolean | undefined>();
    });

    it("keeps undefaulted non-nullable columns required", () => {
      expectTypeOf<Insert["title"]>().toEqualTypeOf<string>();
      expectTypeOf<Insert["category"]>().toEqualTypeOf<number>();
    });

    it("makes nullable columns optional", () => {
      expectTypeOf<Insert["excerpt"]>().toEqualTypeOf<
        null | string | undefined
      >();
      expectTypeOf<Insert["author"]>().toEqualTypeOf<
        null | number | undefined
      >();
    });
  });

  describe("references", () => {
    it("requires an entry for every relation field", () => {
      // @ts-expect-error - `category` is a relation and needs a thunk
      createContentTable(testArticleContentType, { references: {} });
    });

    it("rejects an entry for a non-relation field", () => {
      createContentTable(testArticleContentType, {
        references: {
          category: () => categories.id,
          // @ts-expect-error - `author` is a user field, wired to core_users
          author: () => categories.id,
        },
      });
    });
  });
});
