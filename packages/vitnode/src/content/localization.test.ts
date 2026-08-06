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
  resolveContentLocalization,
} from "./localization";

/** `publicApi` as `defineContentType` resolves it when there is none. */
const disabledPublicApi = {
  defaultOrder: "desc" as const,
  defaultOrderBy: "publishedAt",
  enabled: false as const,
  fields: [] as never[],
  filterableFields: [] as never[],
  orderableFields: [] as never[],
  path: "",
  searchableFields: [] as never[],
  slugField: "",
};

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
    admin: { label: { plural: "Subjects", singular: "Subject" } },
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

  it("defaults the admin surfaces to the shared fields only", () => {
    const { admin } = testLocalizedNoteContentType;

    expect(admin.form.fields).toEqual(["pinned"]);
    expect(admin.list.columns).toEqual(["pinned", "updatedAt"]);
    expect(admin.list.searchableFields).toEqual([]);
    // The only text field is localized, so there is no shared title to fall
    // back to - and inventing one would make a toast depend on the reader's
    // locale.
    expect(admin.titleField).toBeNull();
  });
});

describe("localization validation", () => {
  it("rejects `localized: true` without a localization block", () => {
    expect(() =>
      defineContentType({
        id: "test.stray",
        tableName: "test_strays",
        fields: { title: field.text({ localized: true, required: true }) },
        admin: { label: { plural: "Strays", singular: "Stray" } },
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
        admin: { label: { plural: "Empties", singular: "Empty" } },
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
        admin: { label: { plural: "Bad", singular: "Bad" } },
      }),
    ).toThrow(/Only slug, text, textarea fields can be localized/);
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
        admin: { label: { plural: "Collides", singular: "Collide" } },
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
        admin: { label: { plural: "Shared", singular: "Shared" } },
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
        admin: { label: { plural: "Localized", singular: "Localized" } },
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
        admin: { label: { plural: "None", singular: "None" } },
      }),
    ).toThrow(/which is not a field on this content type/);
  });

  it("rejects a localized field named in the admin list", () => {
    expect(() =>
      localized({
        admin: {
          label: { plural: "Subjects", singular: "Subject" },
          list: { columns: ["title"] },
        },
      }),
    ).toThrow(/admin.list.columns names the localized field "title"/);
  });

  it("rejects a localized field named in an index", () => {
    expect(() => localized({ indexes: [{ on: ["title"] }] })).toThrow(
      /indexes names the localized field "title"/,
    );
  });
});

describe("Stage 5B capability boundaries", () => {
  const withCapability = (extra: Record<string, unknown>) =>
    defineContentType({
      id: "test.boundary",
      tableName: "test_boundaries",
      localization: { enabled: true, defaultLocale: "en" },
      fields: {
        title: field.text({ localized: true, required: true }),
        slug: field.slug({ localized: true, source: "title" }),
      },
      admin: { label: { plural: "Boundaries", singular: "Boundary" } },
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

  it("refuses localization plus publicApi until Stage 5C", () => {
    expect(() =>
      withCapability({
        publication: { enabled: false },
        publicApi: { enabled: true, fields: ["slug"], path: "boundaries" },
      }),
    ).toThrow();
  });

  it("refuses localization plus search until Stage 5D", () => {
    expect(() =>
      withCapability({
        publication: { enabled: true },
        publicApi: { enabled: true, fields: ["slug"], path: "boundaries" },
        search: { enabled: true, titleField: "title" },
      }),
    ).toThrow();
  });

  it("names the stage in every remaining boundary message", () => {
    // "Not yet" is only useful when it says how long.
    const messageOf = (extra: Record<string, unknown>): string => {
      try {
        withCapability(extra);
      } catch (error) {
        return error instanceof Error ? error.message : "";
      }

      return "";
    };

    expect(
      messageOf({
        publication: { enabled: true },
        publicApi: { enabled: true, fields: ["slug"], path: "boundaries" },
      }),
    ).toMatch(/Stage 5C/);
    // `search` cannot be reached through `defineContentType` while `publicApi` is
    // still refused - a searchable content type has to be a public one - so the
    // 5D message is asserted against the resolver directly.
    expect(() =>
      resolveContentLocalization({
        fields: {
          title: field.text({ localized: true, required: true }),
        },
        id: "test.boundary",
        localization: { defaultLocale: "en", enabled: true },
        publicApi: { ...disabledPublicApi },
        publication: true,
        search: true,
        tableName: "test_boundaries",
      }),
    ).toThrow(/Stage 5D/);
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
