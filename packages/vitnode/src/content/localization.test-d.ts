import { describe, expectTypeOf, it } from "vitest";

import type { testLocalizedArticleContentType } from "@/tests/content-fixtures";

import { testCategoryContentType } from "@/tests/content-fixtures";

import type {
  ContentCreateInput,
  ContentLocalizedValues,
  ContentUpdateInput,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

type Localized = typeof testLocalizedArticleContentType;

const localizedFields = {
  title: field.text({ localized: true, required: true }),
  featured: field.boolean({ defaultValue: false }),
};

describe("localization", () => {
  it("splits localized fields out of the base write input", () => {
    expectTypeOf<keyof ContentCreateInput<Localized>>().toEqualTypeOf<
      "featured" | "views"
    >();
    expectTypeOf<keyof ContentUpdateInput<Localized>>().toEqualTypeOf<
      "featured" | "views"
    >();
    expectTypeOf<ContentLocalizedValues<Localized>>().toEqualTypeOf<{
      body?: null | string;
      slug?: string;
      title: string;
    }>();
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

  it("rejects a localized field where SQL addresses the base table", () => {
    defineContentType({
      id: "test.badorder",
      tableName: "test_bad_orders",
      localization: { defaultLocale: "en" },
      fields: localizedFields,
      admin: {
        // @ts-expect-error - `orderBy` is SQL on the base table.
        list: { orderableFields: ["title"] },
      },
    });
    defineContentType({
      id: "test.badindex",
      tableName: "test_bad_indexes",
      localization: { defaultLocale: "en" },
      fields: localizedFields,
      // @ts-expect-error - the base table has no `title` column to index.
      indexes: [{ on: ["title"] }],
    });
  });
});
