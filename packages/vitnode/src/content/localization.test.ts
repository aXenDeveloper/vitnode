// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testLocalizedArticleContentType,
  testLocalizedNoteContentType,
  testPostContentType,
} from "@/tests/content-fixtures";

import { defineContentType } from "./define";
import { field } from "./fields";
import {
  contentTranslationTableName,
  isLocalizedContentField,
  partitionContentFields,
} from "./localization";

/** Builds a localized content type with one thing swapped out. */
const localized = (
  overrides: Parameters<typeof defineContentType>[0] extends never
    ? never
    : Record<string, unknown>,
) =>
  defineContentType({
    id: "test.subject",
    tableName: "test_subjects",
    localization: { enabled: true, defaultLocale: "en" },
    fields: {
      title: field.text({ localized: true, required: true }),
    },
    ...overrides,
  } as never);

describe("partitionContentFields", () => {
  it("splits the field map by the `localized` flag", () => {
    const { localizedFields, sharedFields } = partitionContentFields(
      testLocalizedArticleContentType.fields,
    );

    expect(Object.keys(localizedFields)).toEqual(["title", "slug", "body"]);
    expect(Object.keys(sharedFields)).toEqual(["featured", "views"]);
  });

  it("preserves declaration order in both halves", () => {
    const { localizedFields } = partitionContentFields(
      testLocalizedArticleContentType.fields,
    );

    // The generated column order, the schema key order and the migration all
    // come off this, so it has to be stable rather than merely correct.
    expect(Object.keys(localizedFields)).toEqual(["title", "slug", "body"]);
  });

  it("treats every field of a non-localized content type as shared", () => {
    const { localizedFields, sharedFields } = partitionContentFields(
      testArticleContentType.fields,
    );

    expect(localizedFields).toEqual({});
    expect(Object.keys(sharedFields)).toEqual(
      Object.keys(testArticleContentType.fields),
    );
  });

  it("reads the same flag `isLocalizedContentField` does", () => {
    const { body, featured } = testLocalizedArticleContentType.fields;

    expect(isLocalizedContentField(body)).toBe(true);
    expect(isLocalizedContentField(featured)).toBe(false);
  });
});

describe("contentTranslationTableName", () => {
  it("suffixes the base table name", () => {
    expect(contentTranslationTableName("example_articles")).toBe(
      "example_articles_translations",
    );
  });

  it("stays inside the Postgres identifier limit", () => {
    // 63 characters is where Postgres truncates silently, and two long names
    // that differ only past that point would collapse into one index.
    const long = `a_${"very_long_table_name".repeat(4)}`;
    const name = contentTranslationTableName(long);

    expect(name.length).toBeLessThanOrEqual(63);
    expect(name).not.toBe(contentTranslationTableName(`${long}_other`));
  });
});

describe("resolved localization defaults", () => {
  it("is disabled for a content type that omits the block", () => {
    expect(testArticleContentType.localization).toEqual({
      defaultLocale: "",
      enabled: false,
      fallback: "none",
      translationIndexes: [],
      translationTableName: "",
    });
  });

  it("defaults `fallback` to none, the only safe answer in Stage 5A", () => {
    expect(testLocalizedNoteContentType.localization.fallback).toBe("none");
  });

  it("keeps the configured default locale verbatim, casing included", () => {
    // `core_languages.code` is the canonical form and the resolver matches
    // case-insensitively, so the definition is not the place to normalise.
    expect(testLocalizedNoteContentType.localization.defaultLocale).toBe("EN");
  });

  it("derives the translation table name and its indexes", () => {
    const { translationIndexes, translationTableName } =
      testLocalizedArticleContentType.localization;

    expect(translationTableName).toBe("test_localized_articles_translations");
    expect(translationIndexes).toEqual([
      {
        name: "test_localized_articles_translations_language_id_idx",
        on: ["languageId"],
        unique: false,
      },
      {
        name: "test_localized_articles_translations_language_id_slug_key",
        on: ["languageId", "slug"],
        unique: true,
      },
    ]);
  });

  it("keeps localized fields out of the base indexes", () => {
    const columns = testLocalizedArticleContentType.indexes.flatMap(
      index => index.on,
    );

    expect(columns).not.toContain("slug");
    expect(columns).not.toContain("title");
  });

  it("puts every field on one form, localized or not", () => {
    const { admin } = testLocalizedNoteContentType;

    // One form, in declaration order. A localized input renders its own language
    // switcher, so there is nothing for a second surface to hold.
    expect(admin.form.fields).toEqual(["heading", "slug", "pinned"]);
  });

  it("defaults the list and the query surfaces to shared columns only", () => {
    const { admin } = testLocalizedNoteContentType;

    // A localized field is one column on the *translation* table. Showing it is
    // a display decision the author opts into; ordering, filtering and searching
    // are SQL on the base table and stay shared-only.
    expect(admin.list.columns).toEqual(["pinned", "updatedAt"]);
    expect(admin.list.searchableFields).toEqual([]);
    expect(admin.list.orderableFields).toEqual([]);
  });

  it("falls back to a localized title rather than to none at all", () => {
    // Every text field here is localized, so there is no shared title. The
    // AdminCP resolves this one in whichever language the reader is using, which
    // is a name where the alternative was `#123`.
    expect(testLocalizedNoteContentType.admin.titleField).toBe("heading");
  });
});

describe("localization validation", () => {
  it("rejects `localized: true` without a localization block", () => {
    expect(() =>
      defineContentType({
        id: "test.stray",
        tableName: "test_strays",
        fields: { title: field.text({ localized: true, required: true }) },
      }),
    ).toThrow(/no `localization: \{ enabled: true, defaultLocale \}` block/);
  });

  it("rejects localization with no localized field", () => {
    expect(() =>
      defineContentType({
        id: "test.empty",
        tableName: "test_empties",
        localization: { enabled: true, defaultLocale: "en" },
        fields: { featured: field.boolean({ defaultValue: false }) },
      }),
    ).toThrow(/no field is marked `localized: true`/);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
  ])("rejects a %s default locale", (_label, defaultLocale) => {
    expect(() =>
      localized({ localization: { defaultLocale, enabled: true } }),
    ).toThrow(/localization.defaultLocale is required/);
  });

  it("rejects a padded default locale rather than trimming it", () => {
    expect(() =>
      localized({ localization: { defaultLocale: " en ", enabled: true } }),
    ).toThrow(/leading or trailing whitespace/);
  });

  it("rejects a default locale that is not shaped like one", () => {
    expect(() =>
      localized({ localization: { defaultLocale: "en_US!", enabled: true } }),
    ).toThrow(/does not look like a locale code/);
  });

  it("rejects a default locale wider than core_languages.code", () => {
    expect(() =>
      localized({
        localization: { defaultLocale: "en-".repeat(20), enabled: true },
      }),
    ).toThrow(/longer than 32 characters/);
  });

  it.each(["pt-BR", "zh-Hans", "en"])("accepts the locale %s", locale => {
    expect(
      localized({ localization: { defaultLocale: locale, enabled: true } })
        .localization.defaultLocale,
    ).toBe(locale);
  });

  it.each([
    ["boolean", field.boolean({ defaultValue: false })],
    ["number", field.number({ integer: true, defaultValue: 0 })],
    ["dateTime", field.dateTime({ nullable: true })],
    ["enum", field.enum({ values: ["a", "b"], defaultValue: "a" })],
    ["user", field.user()],
  ])("rejects a localized %s field at runtime", (_kind, fieldValue) => {
    // The builders do not accept `localized`, so this is only reachable from
    // JavaScript or through a cast - which is exactly why the check exists.
    expect(() =>
      defineContentType({
        id: "test.badkind",
        tableName: "test_bad_kinds",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          other: { ...fieldValue, localized: true } as never,
        },
      }),
    ).toThrow(/Only slug, text, textarea fields and `field.group`/);
  });

  it("rejects a localized field named after a translation column", () => {
    expect(() =>
      defineContentType({
        id: "test.collide",
        tableName: "test_collides",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          itemId: field.text({ localized: true, required: true }),
        },
      }),
    ).toThrow(/collides with a generated translation column/);
  });

  it("rejects a localized slug sourced from a shared field", () => {
    expect(() =>
      defineContentType({
        id: "test.sharedsource",
        tableName: "test_shared_sources",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          name: field.text({ required: true }),
          heading: field.text({ localized: true, required: true }),
          slug: field.slug({ localized: true, source: "name" }),
        },
      }),
    ).toThrow(/Every language would derive the same URL/);
  });

  it("rejects a shared slug sourced from a localized field", () => {
    expect(() =>
      defineContentType({
        id: "test.localizedsource",
        tableName: "test_localized_sources",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          slug: field.slug({ source: "title" }),
        },
      }),
    ).toThrow(/there is no single value to derive from/);
  });

  it("rejects a localized slug whose source does not exist", () => {
    // The shared slug-source check runs first and is the one that fires.
    expect(() =>
      defineContentType({
        id: "test.nosource",
        tableName: "test_no_sources",
        localization: { enabled: true, defaultLocale: "en" },
        fields: {
          title: field.text({ localized: true, required: true }),
          slug: field.slug({ localized: true, source: "headline" }),
        },
      }),
    ).toThrow(/which is not a field on this content type/);
  });

  it("shows a localized field in the admin list", () => {
    // A cell renders a value; it does not order or filter by one. The list
    // resolves the reader's own language for the whole page in one query, so a
    // localized column costs nothing per row.
    expect(
      localized({
        admin: {
          list: { columns: ["title"] },
        },
      }).admin.list.columns,
    ).toEqual(["title"]);
  });

  it("still refuses to order by a localized field", () => {
    // The line that has not moved: `orderBy` is SQL on the base table, and a
    // list ordered per language would make one cursor mean two positions.
    expect(() =>
      localized({
        admin: {
          list: { orderableFields: ["title"] },
        },
      }),
    ).toThrow(/admin.list.orderableFields names the localized field "title"/);
  });

  it("still refuses to search a localized field from the admin list", () => {
    expect(() =>
      localized({
        admin: {
          list: { searchableFields: ["title"] },
        },
      }),
    ).toThrow(/admin.list.searchableFields names the localized field "title"/);
  });

  it("rejects a localized field named in an index", () => {
    expect(() => localized({ indexes: [{ on: ["title"] }] })).toThrow(
      /indexes names the localized field "title"/,
    );
  });
});

describe("capability combinations", () => {
  const withCapability = (extra: Record<string, unknown>) =>
    defineContentType({
      id: "test.boundary",
      tableName: "test_boundaries",
      localization: { enabled: true, defaultLocale: "en" },
      fields: {
        title: field.text({ localized: true, required: true }),
        slug: field.slug({ localized: true, source: "title" }),
      },
      ...extra,
    } as never);

  it("allows localization plus publication from Stage 5B", () => {
    const definition = withCapability({ publication: { enabled: true } });

    expect(definition.publication.enabled).toBe(true);
    // The translation table gains the pair the base table has, so a translation
    // has a status of its own to be subordinate with.
    expect(
      definition.localization.translationIndexes.map(index => index.on),
    ).toContainEqual(["languageId", "status"]);
  });

  it("allows localization plus editorial from Stage 5B", () => {
    const definition = withCapability({ editorial: { enabled: true } });

    expect(definition.editorial.enabled).toBe(true);
    expect(definition.localization.enabled).toBe(true);
  });

  it("allows localization plus publicApi from Stage 5C", () => {
    const definition = withCapability({
      publication: { enabled: true },
      publicApi: { enabled: true, fields: ["slug"], path: "boundaries" },
    });

    expect(definition.publicApi.enabled).toBe(true);
    expect(definition.localization.enabled).toBe(true);
    // The public response carries the language it resolved to, so a reader can
    // tell a translation from a fallback.
    expect(definition.schemas.publicSelectObject.shape).toHaveProperty(
      "locale",
    );
  });

  it("allows localization plus search from Stage 5D", () => {
    const definition = withCapability({
      publication: { enabled: true },
      publicApi: {
        enabled: true,
        fields: ["title", "slug"],
        path: "boundaries",
      },
      search: {
        contentFields: ["title"],
        enabled: true,
        pathTemplate: "/{locale}/boundaries/{slug}",
        titleField: "title",
      },
    });

    expect(definition.search.enabled).toBe(true);
    expect(definition.localization.enabled).toBe(true);
  });

  it("requires a locale in the search path template", () => {
    // One document per language means one URL per language. Without it every
    // translation of a record would carry the same link.
    expect(() =>
      withCapability({
        publication: { enabled: true },
        publicApi: {
          enabled: true,
          fields: ["title", "slug"],
          path: "boundaries",
        },
        search: {
          contentFields: ["title"],
          enabled: true,
          pathTemplate: "/boundaries/{slug}",
          titleField: "title",
        },
      }),
    ).toThrow(/\{locale\}/);
  });
});

describe("backward compatibility", () => {
  it("leaves a Stage 1 content type's generated shape untouched", () => {
    expect(testArticleContentType.localization.enabled).toBe(false);
    expect(testArticleContentType.schemas.translation).toBeNull();
    expect(Object.keys(testArticleContentType.fields)).toContain("title");
  });

  it("leaves a Stage 2 content type's admin defaults untouched", () => {
    expect(testPostContentType.admin.list.searchableFields).toEqual([
      "title",
      "excerpt",
    ]);
    expect(testPostContentType.admin.titleField).toBe("title");
  });

  it("keeps every declared field in `definition.fields`", () => {
    // The partition is derived, never destructive: the definition still
    // describes the whole content type, which is what the AdminCP, the docs and
    // a future migration generator all read.
    expect(Object.keys(testLocalizedArticleContentType.fields)).toEqual([
      "title",
      "slug",
      "body",
      "featured",
      "views",
    ]);
  });
});
