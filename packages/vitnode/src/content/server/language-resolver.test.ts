// @vitest-environment node
import type { Context } from "hono";

import { beforeEach, describe, expect, it } from "vitest";

import {
  testArticleContentType,
  testLocalizedArticleContentType,
  testLocalizedNoteContentType,
} from "@/tests/content-fixtures";

import { ContentEngineError, ContentLanguageError } from "../errors";
import {
  assertContentLocalizationLanguages,
  ensureContentLocalizationLanguages,
  findContentLanguage,
  findContentLocalizationProblems,
  listContentLanguages,
  resetContentLocalizationCheck,
  resolveContentLanguage,
  resolveDefaultContentLanguage,
} from "./language-resolver";

interface LanguageRow {
  code: string;
  id: number;
  isDefault: boolean;
}

const DEFAULT_ROWS: LanguageRow[] = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
  { code: "pt-BR", id: 3, isDefault: false },
];

/**
 * A context whose `select().from()` returns the language rows and counts how
 * many times it was asked - which is the whole point of the per-request cache.
 */
const createRequestContext = ({
  locales,
  rows = DEFAULT_ROWS,
}: {
  locales?: { code: string; enabled?: boolean; name: string }[];
  rows?: LanguageRow[];
} = {}) => {
  let queries = 0;

  const db = {
    select: () => ({
      // A plain array, not a promise: `await` resolves it just the same, and it
      // keeps the mock out of the require-await / promise-function-async
      // crossfire.
      from: () => {
        queries += 1;

        return rows;
      },
    }),
  };

  const c = {
    get: (key: string) => {
      if (key === "db") return db;
      if (key === "core") {
        return locales ? { i18n: { locales } } : undefined;
      }

      return undefined;
    },
  } as unknown as Context;

  return { c, queries: () => queries };
};

beforeEach(() => {
  resetContentLocalizationCheck();
});

describe("listContentLanguages", () => {
  it("returns every language with its id and canonical locale", async () => {
    const { c } = createRequestContext();

    expect(await listContentLanguages(c)).toEqual([
      { id: 1, isDefault: true, isEnabled: true, locale: "en" },
      { id: 2, isDefault: false, isEnabled: true, locale: "pl" },
      { id: 3, isDefault: false, isEnabled: true, locale: "pt-BR" },
    ]);
  });

  it("queries once per request however often it is asked", async () => {
    const { c, queries } = createRequestContext();

    await listContentLanguages(c);
    await findContentLanguage(c, "pl");
    await resolveContentLanguage(c, { locale: "en" });

    // The alternative - `WHERE code = $1` per lookup - is one query per locale,
    // which is exactly the N+1 a list of translations would turn into.
    expect(queries()).toBe(1);
  });

  it("does not cache a failed load", async () => {
    let attempts = 0;
    const db = {
      select: () => ({
        from: () => {
          attempts += 1;
          // Thrown synchronously inside the resolver's `await`, which rejects
          // its promise exactly as a driver failure would.
          if (attempts === 1) throw new Error("connection reset");

          return DEFAULT_ROWS;
        },
      }),
    };
    const c = {
      get: (key: string) => (key === "db" ? db : undefined),
    } as unknown as Context;

    await expect(listContentLanguages(c)).rejects.toThrow("connection reset");
    // A blip must not poison the rest of the request.
    expect(await listContentLanguages(c)).toHaveLength(3);
  });

  it("marks a locale the app config disables", async () => {
    const { c } = createRequestContext({
      locales: [
        { code: "en", name: "English" },
        { code: "pl", enabled: false, name: "Polski" },
      ],
    });

    const languages = await listContentLanguages(c);

    expect(languages.map(language => language.isEnabled)).toEqual([
      true,
      false,
      // Not mentioned by the config at all, which is not the same as switched
      // off: dropping a locale from `i18n.locales` must not make existing
      // content unwritable.
      true,
    ]);
  });
});

describe("findContentLanguage", () => {
  it("matches case-insensitively and returns the canonical locale", async () => {
    const { c } = createRequestContext();

    // A locale travels in a URL, and `/PL/` naming the same language as `/pl/`
    // is what people expect - but what gets stored is the row's own code.
    expect((await findContentLanguage(c, "PL"))?.locale).toBe("pl");
    expect((await findContentLanguage(c, "pt-br"))?.locale).toBe("pt-BR");
    expect((await findContentLanguage(c, "  en  "))?.locale).toBe("en");
  });

  it("returns null for an unknown or empty locale", async () => {
    const { c } = createRequestContext();

    expect(await findContentLanguage(c, "de")).toBeNull();
    expect(await findContentLanguage(c, "")).toBeNull();
    expect(await findContentLanguage(c, "   ")).toBeNull();
  });
});

describe("resolveContentLanguage", () => {
  it("resolves an existing language", async () => {
    const { c } = createRequestContext();

    expect(await resolveContentLanguage(c, { locale: "pl" })).toEqual({
      id: 2,
      isDefault: false,
      isEnabled: true,
      locale: "pl",
    });
  });

  it("throws `missing` for an unknown locale", async () => {
    const { c } = createRequestContext();

    await expect(
      resolveContentLanguage(c, { locale: "de" }),
    ).rejects.toMatchObject({ reason: "missing" });
  });

  it("reads a disabled language but refuses to write one", async () => {
    const { c } = createRequestContext({
      locales: [{ code: "pl", enabled: false, name: "Polski" }],
    });

    // Reading is fine: the content is already there, and hiding it would make it
    // unrecoverable.
    expect((await resolveContentLanguage(c, { locale: "pl" })).id).toBe(2);

    await expect(
      resolveContentLanguage(c, { locale: "pl", requireEnabled: true }),
    ).rejects.toMatchObject({ reason: "disabled" });
  });

  it("distinguishes missing from disabled in its message", async () => {
    const { c } = createRequestContext({
      locales: [{ code: "pl", enabled: false, name: "Polski" }],
    });

    await expect(resolveContentLanguage(c, { locale: "de" })).rejects.toThrow(
      /Unknown locale "de"/,
    );
    await expect(
      resolveContentLanguage(c, { locale: "pl", requireEnabled: true }),
    ).rejects.toThrow(/is disabled on this installation/);
  });

  it("names the content type in the error when it knows one", async () => {
    const { c } = createRequestContext();

    await expect(
      resolveContentLanguage(c, {
        contentTypeId: "test.localized",
        locale: "de",
      }),
    ).rejects.toThrow(/test\.localized/);
  });
});

describe("resolveDefaultContentLanguage", () => {
  it("resolves the configured default locale", async () => {
    const { c } = createRequestContext();

    expect(
      await resolveDefaultContentLanguage(c, testLocalizedArticleContentType),
    ).toMatchObject({ id: 1, locale: "en" });
  });

  it("matches the default locale case-insensitively too", async () => {
    const { c } = createRequestContext();

    // The note fixture configures `EN`; the canonical code is `en`.
    expect(
      await resolveDefaultContentLanguage(c, testLocalizedNoteContentType),
    ).toMatchObject({ id: 1, locale: "en" });
  });

  it("refuses a content type without localization", async () => {
    const { c } = createRequestContext();

    await expect(
      resolveDefaultContentLanguage(c, testArticleContentType),
    ).rejects.toBeInstanceOf(ContentEngineError);
  });

  it("throws when the default language is gone", async () => {
    const { c } = createRequestContext({
      rows: [{ code: "pl", id: 2, isDefault: true }],
    });

    await expect(
      resolveDefaultContentLanguage(c, testLocalizedArticleContentType),
    ).rejects.toBeInstanceOf(ContentLanguageError);
  });
});

describe("the boot guard", () => {
  const entries = [
    {
      definition: testLocalizedArticleContentType,
      pluginId: "@vitnode/example",
    },
    { definition: testArticleContentType, pluginId: "@vitnode/example" },
  ];

  it("passes when every default locale resolves", async () => {
    const { c } = createRequestContext();

    await expect(
      assertContentLocalizationLanguages(c, entries),
    ).resolves.toBeUndefined();
  });

  it("never touches the languages table with nothing localized", async () => {
    const { c, queries } = createRequestContext();

    await assertContentLocalizationLanguages(c, [
      { definition: testArticleContentType, pluginId: "@vitnode/example" },
    ]);

    // An install that defines no localized content type must not pay for this.
    expect(queries()).toBe(0);
  });

  it("reports a missing default language", async () => {
    const { c } = createRequestContext({
      rows: [{ code: "pl", id: 2, isDefault: true }],
    });

    expect(await findContentLocalizationProblems(c, entries)).toEqual([
      {
        contentTypeId: "test.localized",
        defaultLocale: "en",
        reason: "missing",
      },
    ]);
  });

  it("reports a disabled default language", async () => {
    const { c } = createRequestContext({
      locales: [{ code: "en", enabled: false, name: "English" }],
    });

    expect(await findContentLocalizationProblems(c, entries)).toEqual([
      {
        contentTypeId: "test.localized",
        defaultLocale: "en",
        reason: "disabled",
      },
    ]);
  });

  it("names every offender in one error rather than failing on the first", async () => {
    const { c } = createRequestContext({
      rows: [{ code: "de", id: 9, isDefault: true }],
    });

    await expect(
      assertContentLocalizationLanguages(c, [
        ...entries,
        {
          definition: testLocalizedNoteContentType,
          pluginId: "@vitnode/example",
        },
      ]),
    ).rejects.toThrow(/test\.localized[\s\S]*test\.localized-note/);
  });

  it("runs at most once per process", async () => {
    const { c, queries } = createRequestContext();

    await ensureContentLocalizationLanguages(c, entries);
    await ensureContentLocalizationLanguages(c, entries);

    // The definitions cannot change while the process runs, so re-checking every
    // request would be pure cost. One query, for the one check.
    expect(queries()).toBe(1);
  });

  it("does not memoise a failure", async () => {
    const broken = createRequestContext({
      rows: [{ code: "pl", id: 2, isDefault: true }],
    });

    await expect(
      ensureContentLocalizationLanguages(broken.c, entries),
    ).rejects.toThrow();

    const healthy = createRequestContext();
    // A database that was not up yet gets checked again rather than poisoning
    // the process.
    await expect(
      ensureContentLocalizationLanguages(healthy.c, entries),
    ).resolves.toBeUndefined();
  });
});
