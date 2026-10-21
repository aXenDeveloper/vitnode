import { describe, expectTypeOf, it } from "vitest";

import type { SearchableContentTypeDefinition } from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

const shared = {
  admin: { titleField: "title" },
  fields: {
    author: field.user(),
    body: field.textarea({ nullable: true }),
    code: field.text({ required: true }),
    excerpt: field.textarea({ nullable: true }),
    featured: field.boolean({ defaultValue: false }),
    slug: field.slug({ source: "title" }),
    subtitle: field.text({ nullable: true }),
    title: field.text({ required: true }),
    views: field.number({ integer: true, defaultValue: 0 }),
  },
  id: "test.search",
  publicApi: {
    fields: [
      "title",
      "slug",
      "excerpt",
      "body",
      "featured",
      "subtitle",
      "publishedAt",
    ],
    path: "articles",
  },
  publication: true,
  tableName: "test_search",
} as const;

const search = {
  contentFields: ["excerpt"],
  pathTemplate: "/articles/{slug}",
  titleField: "title",
} as const;

describe("search configuration", () => {
  it("makes a configured definition searchable without an assertion", () => {
    const definition = defineContentType({
      ...shared,
      search: { ...search, authorField: "author", descriptionField: "excerpt" },
    });
    const plain = defineContentType(shared);

    expectTypeOf(definition).toExtend<SearchableContentTypeDefinition>();
    expectTypeOf(plain).not.toExtend<SearchableContentTypeDefinition>();
  });

  it("rejects a title that is nullable, prose or not text", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - a nullable field can never be a result heading
      search: { ...search, titleField: "subtitle" },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - prose does not belong in the title slot
      search: { ...search, titleField: "excerpt" },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - `views` is a number field
      search: { ...search, titleField: "views" },
    });
  });

  it("rejects indexing a field the public API withholds", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - `code` is not in `publicApi.fields`
      search: { ...search, contentFields: ["code"] },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - a user field is never public
      search: { ...search, contentFields: ["author"] },
    });
  });

  it("rejects an authorField that is not a user field", () => {
    defineContentType({
      ...shared,
      // @ts-expect-error - only a user field credits a person
      search: { ...search, authorField: "title" },
    });
  });

  it("rejects a widened `enabled` and an empty contentFields", () => {
    const enabled = true as boolean;

    defineContentType({
      ...shared,
      // @ts-expect-error - `enabled` must stay a literal
      search: { enabled },
    });
    defineContentType({
      ...shared,
      // @ts-expect-error - at least one content field
      search: { ...search, contentFields: [] },
    });
  });
});
