import { describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
} from "@/tests/content-fixtures";

import type { ContentSelect } from "../types";

import { createContentTable } from "./table";

const categories = createContentTable(testCategoryContentType);

describe("createContentTable", () => {
  it("infers the descriptor-derived row", () => {
    const articles = createContentTable(testArticleContentType, {
      references: { category: () => categories.id },
    });

    expectTypeOf<(typeof articles)["$inferSelect"]>().toEqualTypeOf<
      ContentSelect<typeof testArticleContentType>
    >();
  });

  it("requires a reference for every relation field and nothing else", () => {
    // @ts-expect-error - `category` is a relation and needs a thunk
    createContentTable(testArticleContentType, { references: {} });
    createContentTable(testArticleContentType, {
      references: {
        category: () => categories.id,
        // @ts-expect-error - `author` is a user field, wired to core_users
        author: () => categories.id,
      },
    });
  });
});
