// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it } from "vitest";

import {
  testLocalizedPageContentType,
  testStrictLocalizedPageContentType,
} from "@/tests/content-fixtures";

import { core_languages } from "../../database/languages";
import { createContentModel } from "./model";
import { contentPublicLocaleStates } from "./public-locales";

const LANGUAGE_ROWS = [
  { code: "en", id: 1, isDefault: true },
  { code: "pl", id: 2, isDefault: false },
  { code: "de", id: 3, isDefault: false },
  // Switched off, so it has no public page in any state and is not reported.
  { code: "cs", id: 4, isDefault: false },
];

const CORE = {
  i18n: {
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
      { code: "de", name: "Deutsch" },
      { code: "cs", enabled: false, name: "Čeština" },
    ],
  },
};

const fallbackPages = createContentModel(testLocalizedPageContentType);
const strictPages = createContentModel(testStrictLocalizedPageContentType);

const PAST = new Date("2020-01-01T00:00:00.000Z");

const published = { publishedAt: PAST, status: "published" };
const draft = { publishedAt: null, status: "draft" };

const context = (...resultSets: Record<string, unknown>[][]): Context => {
  let call = 0;

  const db = {
    select: () => ({
      from: (table: unknown) => {
        if (table === core_languages) return LANGUAGE_ROWS;

        const rows = resultSets[call] ?? [];
        call += 1;

        // Both a promise and a builder, which is exactly what the real query
        // builder is: the base read ends in `.limit(1)` and the translation read
        // is awaited directly. Typed loosely so the linter does not read it as an
        // ordinary promise-returning function and rewrite it.
        const result = Object.assign(Promise.resolve(rows), {
          limit: async (value: number) =>
            await Promise.resolve(rows.slice(0, value)),
        }) as unknown as Record<string, unknown>;

        return { where: () => result };
      },
    }),
  };

  return {
    get: (key: string) => {
      if (key === "db") return db;
      if (key === "core") return CORE;

      return undefined;
    },
  } as never;
};

/** The common case: one base row plus its translations. */
const contextWithRow = (
  base: Record<string, unknown>,
  translations: Record<string, unknown>[],
): Context => context([base], translations);

describe("contentPublicLocaleStates", () => {
  it("reports only the enabled languages", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...published }, []),
      fallbackPages,
      7,
    );

    expect(states.map(state => state.locale)).toEqual(["en", "pl", "de"]);
  });

  it("marks a locale served by its own published translation", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...published }, [
        { ...published, languageId: 2, slug: "witaj" },
      ]),
      fallbackPages,
      7,
    );

    expect(states.find(state => state.locale === "pl")).toEqual({
      hasOwnTranslation: true,
      isPublic: true,
      locale: "pl",
      slug: "witaj",
    });
  });

  it("marks a locale served by the fallback", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...published }, [
        { ...published, languageId: 1, slug: "hello" },
      ]),
      fallbackPages,
      7,
    );

    // Public, and explicitly not by a translation of its own - which is what
    // makes it a downstream consumer of the default locale's cache.
    expect(states.find(state => state.locale === "de")).toEqual({
      hasOwnTranslation: false,
      isPublic: true,
      locale: "de",
      slug: "hello",
    });
  });

  it("does not fall back when the content type says `none`", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...published }, [
        { ...published, languageId: 1, slug: "hello" },
      ]),
      strictPages,
      7,
    );

    expect(states.find(state => state.locale === "de")).toMatchObject({
      isPublic: false,
    });
  });

  it("treats a draft translation as not its own, so the fallback applies", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...published }, [
        { ...published, languageId: 1, slug: "hello" },
        { ...draft, languageId: 2, slug: "witaj" },
      ]),
      fallbackPages,
      7,
    );

    expect(states.find(state => state.locale === "pl")).toEqual({
      hasOwnTranslation: false,
      isPublic: true,
      locale: "pl",
      slug: "hello",
    });
  });

  it("makes every locale private when the record itself is a draft", async () => {
    // Subordination: publishing a translation of a draft record puts nothing on
    // the internet, in any language.
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...draft }, [
        { ...published, languageId: 1, slug: "hello" },
        { ...published, languageId: 2, slug: "witaj" },
      ]),
      fallbackPages,
      7,
    );

    expect(states.every(state => !state.isPublic)).toBe(true);
  });

  it("keeps a withdrawn locale's slug, so its page can still be expired", async () => {
    const states = await contentPublicLocaleStates(
      contextWithRow({ ...draft }, [
        { ...published, languageId: 2, slug: "witaj" },
      ]),
      fallbackPages,
      7,
    );

    expect(states.find(state => state.locale === "pl")).toMatchObject({
      isPublic: false,
      slug: "witaj",
    });
  });

  it("returns nothing for a record that does not exist", async () => {
    expect(
      await contentPublicLocaleStates(context([]), fallbackPages, 7),
    ).toEqual([]);
  });

  it("reads the base row from the caller when it already has one", async () => {
    // No base query at all - so the *first* result set the fake hands out is
    // the translations. The schedule handler holds the row its transition
    // returned, and re-reading it could see a later edit.
    const states = await contentPublicLocaleStates(
      context([{ ...published, languageId: 2, slug: "witaj" }]),
      fallbackPages,
      7,
      { row: { ...published } },
    );

    expect(states.find(state => state.locale === "pl")).toMatchObject({
      isPublic: true,
    });
  });
});
