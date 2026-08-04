import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  testArticleContentType,
  testCategoryContentType,
  testPostContentType,
  testSearchablePostContentType,
} from "@/tests/content-fixtures";

import type {
  AnyContentTypeDefinition,
  SearchableContentTypeDefinition,
} from "./types";

import { defineContentType } from "./define";
import { field } from "./fields";

/** The fields every case below reuses. `code` and `author` are never exposed. */
const fields = {
  author: field.user(),
  body: field.textarea({ nullable: true }),
  code: field.text({ required: true }),
  excerpt: field.textarea({ nullable: true }),
  featured: field.boolean({ defaultValue: false }),
  slug: field.slug({ source: "title" }),
  title: field.text({ required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const publicApi = {
  enabled: true,
  fields: ["title", "slug", "excerpt", "body", "featured", "publishedAt"],
  path: "articles",
} as const;

const admin = {
  label: { plural: "Articles", singular: "Article" },
  titleField: "title",
} as const;

describe("search configuration types", () => {
  it("accepts a valid configuration", () => {
    const definition = defineContentType({
      admin,
      fields,
      id: "test.valid",
      publicApi,
      publication: { enabled: true },
      search: {
        contentFields: ["excerpt", "body"],
        descriptionField: "excerpt",
        enabled: true,
        pathTemplate: "/articles/{slug}",
        titleField: "title",
      },
      tableName: "test_valid",
    });

    expectTypeOf(definition.search.contentFields).toEqualTypeOf<string[]>();
    expectTypeOf(definition.search.descriptionField).toEqualTypeOf<
      null | string
    >();
    expectTypeOf(definition.search.enabled).toEqualTypeOf<boolean>();
  });

  it("accepts an explicit `enabled: false`", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.off",
        publicApi,
        publication: { enabled: true },
        search: { enabled: false },
        tableName: "test_off",
      }),
    );
  });

  it("rejects a widened `enabled`", () => {
    const enabled = true as boolean;

    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.widened",
        publicApi,
        publication: { enabled: true },
        // @ts-expect-error - `enabled` must stay a literal, or every conditional
        // in the engine silently resolves to the disabled branch.
        search: { enabled },
        tableName: "test_widened",
      }),
    );
  });

  it("rejects a titleField that is not a text field", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.title.kind",
        publicApi,
        publication: { enabled: true },
        search: {
          contentFields: ["excerpt"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          // @ts-expect-error - `views` is a number field.
          titleField: "views",
        },
        tableName: "test_title_kind",
      }),
    );
  });

  it("rejects a textarea titleField", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.title.textarea",
        publicApi,
        publication: { enabled: true },
        search: {
          contentFields: ["excerpt"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          // @ts-expect-error - prose does not belong in the title slot.
          titleField: "excerpt",
        },
        tableName: "test_title_textarea",
      }),
    );
  });

  it("rejects a descriptionField that is not textual", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.desc.kind",
        publicApi,
        publication: { enabled: true },
        search: {
          contentFields: ["excerpt"],
          // @ts-expect-error - `featured` is a boolean field.
          descriptionField: "featured",
          enabled: true,
          pathTemplate: "/articles/{slug}",
          titleField: "title",
        },
        tableName: "test_desc_kind",
      }),
    );
  });

  it("rejects a private field in contentFields", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.private",
        publicApi,
        publication: { enabled: true },
        search: {
          // @ts-expect-error - `code` is a text field, but it is not in
          // `publicApi.fields`, so indexing it would leak it.
          contentFields: ["code"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          titleField: "title",
        },
        tableName: "test_private",
      }),
    );
  });

  it("rejects a user field", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.user",
        publicApi,
        publication: { enabled: true },
        search: {
          // @ts-expect-error - a user field can never be public, so it can never
          // be indexed either.
          contentFields: ["author"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          titleField: "title",
        },
        tableName: "test_user",
      }),
    );
  });

  it("rejects search without a public API", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.nopublic",
        publication: { enabled: true },
        search: {
          // @ts-expect-error - with no `publicApi` there is no allowlist, so no
          // field name is indexable.
          contentFields: ["excerpt"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          // @ts-expect-error - same reason.
          titleField: "title",
        },
        tableName: "test_nopublic",
      }),
    );
  });

  it("rejects an empty contentFields", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.empty",
        publicApi,
        publication: { enabled: true },
        search: {
          // @ts-expect-error - the tuple type requires at least one entry.
          contentFields: [],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          titleField: "title",
        },
        tableName: "test_empty",
      }),
    );
  });
});

describe("search backward compatibility", () => {
  it("keeps every existing fixture assignable to the erased definition", () => {
    expectTypeOf(testCategoryContentType).toExtend<AnyContentTypeDefinition>();
    expectTypeOf(testArticleContentType).toExtend<AnyContentTypeDefinition>();
    expectTypeOf(testPostContentType).toExtend<AnyContentTypeDefinition>();
    expectTypeOf(
      testSearchablePostContentType,
    ).toExtend<AnyContentTypeDefinition>();
  });

  it("gives every definition a resolved `search`, enabled or not", () => {
    expectTypeOf(
      testCategoryContentType.search.enabled,
    ).toEqualTypeOf<boolean>();
    expectTypeOf(testPostContentType.search.titleField).toEqualTypeOf<string>();
  });

  it("narrows only through SearchableContentTypeDefinition", () => {
    const searchable: SearchableContentTypeDefinition =
      testSearchablePostContentType as SearchableContentTypeDefinition;

    expectTypeOf(searchable.search.enabled).toEqualTypeOf<true>();
  });
});
