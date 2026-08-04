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
  // Public and textual, but nullable - so it is a legal description and an
  // illegal title.
  subtitle: field.text({ nullable: true }),
  title: field.text({ required: true }),
  views: field.number({ integer: true, defaultValue: 0 }),
};

const publicApi = {
  enabled: true,
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
    // The literal survives, which is what makes the definition assignable to
    // `SearchableContentTypeDefinition` without an assertion.
    expectTypeOf(definition.search.enabled).toEqualTypeOf<true>();
    expectTypeOf(definition).toExtend<SearchableContentTypeDefinition>();

    const searchable: SearchableContentTypeDefinition = definition;
    expectTypeOf(searchable.search.enabled).toEqualTypeOf<true>();
  });

  it("accepts an explicit `enabled: false`", () => {
    const definition = defineContentType({
      admin,
      fields,
      id: "test.off",
      publicApi,
      publication: { enabled: true },
      search: { enabled: false },
      tableName: "test_off",
    });

    expectTypeOf(definition.search.enabled).toEqualTypeOf<false>();
    expectTypeOf(definition).not.toExtend<SearchableContentTypeDefinition>();
  });

  it("resolves an omitted `search` to a literal `false`", () => {
    const definition = defineContentType({
      admin,
      fields,
      id: "test.absent",
      publicApi,
      publication: { enabled: true },
      tableName: "test_absent",
    });

    expectTypeOf(definition.search.enabled).toEqualTypeOf<false>();
    expectTypeOf(definition).not.toExtend<SearchableContentTypeDefinition>();
  });

  it("rejects a nullable titleField", () => {
    assertType(
      defineContentType({
        admin,
        fields,
        id: "test.nullable.title",
        publicApi,
        publication: { enabled: true },
        search: {
          contentFields: ["excerpt"],
          enabled: true,
          pathTemplate: "/articles/{slug}",
          // @ts-expect-error - a nullable field can never be a result heading.
          titleField: "subtitle",
        },
        tableName: "test_nullable_title",
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
    // Stage 1 and Stage 2 fixtures declare no `search` at all, and resolve to a
    // literal `false` rather than a widened `boolean`.
    expectTypeOf(testCategoryContentType.search.enabled).toEqualTypeOf<false>();
    expectTypeOf(testArticleContentType.search.enabled).toEqualTypeOf<false>();
    expectTypeOf(testPostContentType.search.enabled).toEqualTypeOf<false>();
    expectTypeOf(testPostContentType.search.titleField).toEqualTypeOf<string>();
  });

  it("satisfies SearchableContentTypeDefinition with no assertion", () => {
    // The whole point of the literal: no `as`, anywhere.
    const searchable: SearchableContentTypeDefinition =
      testSearchablePostContentType;

    expectTypeOf(searchable.search.enabled).toEqualTypeOf<true>();
    expectTypeOf(
      testSearchablePostContentType,
    ).toExtend<SearchableContentTypeDefinition>();
  });

  it("keeps a search-less definition out of SearchableContentTypeDefinition", () => {
    expectTypeOf(
      testPostContentType,
    ).not.toExtend<SearchableContentTypeDefinition>();
    expectTypeOf(
      testCategoryContentType,
    ).not.toExtend<SearchableContentTypeDefinition>();
  });
});
