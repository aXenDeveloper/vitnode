import type { Context } from "hono";

import type { RegisteredContentType } from "../registry";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { core_languages } from "../../database/languages";
import { ContentEngineError, ContentLanguageError } from "../errors";

export interface ContentLanguage {
  /** `core_languages.id`. The foreign key a translation row actually holds. */
  id: number;
  /** Whether `core_languages.default` is set on this row. */
  isDefault: boolean;
  /** Whether the app config serves this locale. Disabled ones are read-only. */
  isEnabled: boolean;
  locale: string;
}

const perRequest = new WeakMap<Context, Promise<ContentLanguage[]>>();

const disabledLocales = (c: Context): ReadonlySet<string> => {
  const locales = c.get("core")?.i18n?.locales ?? [];

  return new Set(
    locales
      .filter(locale => locale.enabled === false)
      .map(locale => locale.code.toLowerCase()),
  );
};

const load = async (
  c: Context,
  tx?: ContentDatabase,
): Promise<ContentLanguage[]> => {
  const disabled = disabledLocales(c);

  const rows = await contentDatabase(c, tx)
    .select({
      code: core_languages.code,
      id: core_languages.id,
      isDefault: core_languages.default,
    })
    .from(core_languages);

  return rows.map(row => ({
    id: row.id,
    isDefault: row.isDefault,
    // `core_languages` is the registry of languages that *exist*; the app config
    // says which ones it currently serves. A language the config does not
    // mention at all stays usable - dropping a locale from `i18n.locales` must
    // not make existing content unwritable - but one listed with
    // `enabled: false` is a deliberate switch-off.
    isEnabled: !disabled.has(row.code.toLowerCase()),
    locale: row.code,
  }));
};

export const listContentLanguages = async (
  c: Context,
  tx?: ContentDatabase,
): Promise<ContentLanguage[]> => {
  const cached = perRequest.get(c);
  if (cached) return await cached;

  const pending = load(c, tx);
  perRequest.set(c, pending);

  try {
    return await pending;
  } catch (error) {
    // A failed load must not be cached: the next call in the same request would
    // get the same rejection with no chance of recovering from a blip.
    perRequest.delete(c);
    throw error;
  }
};

export const findContentLanguage = async (
  c: Context,
  locale: string,
  tx?: ContentDatabase,
): Promise<ContentLanguage | null> => {
  const wanted = locale.trim().toLowerCase();
  if (wanted === "") return null;

  const languages = await listContentLanguages(c, tx);

  return (
    languages.find(language => language.locale.toLowerCase() === wanted) ?? null
  );
};

export const resolveContentLanguage = async (
  c: Context,
  {
    contentTypeId,
    locale,
    requireEnabled = false,
    tx,
  }: {
    contentTypeId?: string;
    locale: string;
    requireEnabled?: boolean;
    /** Read inside this transaction. See {@link listContentLanguages}. */
    tx?: ContentDatabase;
  },
): Promise<ContentLanguage> => {
  const language = await findContentLanguage(c, locale, tx);

  if (!language) {
    throw new ContentLanguageError({
      contentTypeId,
      locale,
      reason: "missing",
    });
  }

  if (requireEnabled && !language.isEnabled) {
    throw new ContentLanguageError({
      contentTypeId,
      locale: language.locale,
      reason: "disabled",
    });
  }

  return language;
};

export const resolveDefaultContentLanguage = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  tx?: ContentDatabase,
): Promise<ContentLanguage> => {
  if (!definition.localization.enabled) {
    throw new ContentEngineError(
      "This content type has no `localization` block, so it has no default locale.",
      { contentTypeId: definition.id },
    );
  }

  return await resolveContentLanguage(c, {
    contentTypeId: definition.id,
    locale: definition.localization.defaultLocale,
    requireEnabled: true,
    tx,
  });
};

/** One localized content type whose configured default locale does not work. */
export interface ContentLocalizationProblem {
  contentTypeId: string;
  defaultLocale: string;
  reason: "disabled" | "missing";
}

export const findContentLocalizationProblems = async (
  c: Context,
  contentTypes: readonly RegisteredContentType[],
): Promise<ContentLocalizationProblem[]> => {
  const localized = contentTypes.filter(
    entry => entry.definition.localization.enabled,
  );
  if (localized.length === 0) return [];

  const languages = await listContentLanguages(c);
  const byLocale = new Map(
    languages.map(language => [language.locale.toLowerCase(), language]),
  );
  const problems: ContentLocalizationProblem[] = [];

  for (const { definition } of localized) {
    const { defaultLocale } = definition.localization;
    const language = byLocale.get(defaultLocale.trim().toLowerCase());

    if (!language) {
      problems.push({
        contentTypeId: definition.id,
        defaultLocale,
        reason: "missing",
      });
      continue;
    }

    if (!language.isEnabled) {
      problems.push({
        contentTypeId: definition.id,
        defaultLocale,
        reason: "disabled",
      });
    }
  }

  return problems;
};

const describeProblem = (problem: ContentLocalizationProblem): string =>
  `${problem.contentTypeId} -> localization.defaultLocale "${problem.defaultLocale}" ${
    problem.reason === "missing"
      ? "does not exist in core_languages"
      : "is disabled in this app's i18n.locales"
  }`;

/**
 * The boot guard: refuses to serve an install whose localized content types name
 * a default locale it cannot honour.
 *
 * Loud on purpose. A localized record is created with its default translation in
 * one transaction, so a broken `defaultLocale` means *no record can be created
 * at all* - it is not a degraded mode worth booting into.
 */
export const assertContentLocalizationLanguages = async (
  c: Context,
  contentTypes: readonly RegisteredContentType[],
): Promise<void> => {
  const problems = await findContentLocalizationProblems(c, contentTypes);
  if (problems.length === 0) return;

  throw new ContentEngineError(
    `Localized content types have an unusable default locale:\n  ${problems
      .map(describeProblem)
      .join("\n  ")}`,
  );
};

/**
 * The same check, run at most once per process.
 *
 * Memoised rather than repeated per request: the languages table can change while
 * the process runs, but a *definition's* `defaultLocale` cannot - and the failure
 * this catches is a configuration mistake, which is either there at boot or not
 * at all. A language deleted afterwards is caught by the foreign key.
 *
 * A failure is not memoised, so a database that was not up yet gets checked
 * again on the next request instead of poisoning the process.
 */
let bootCheck: Promise<void> | undefined;

export const ensureContentLocalizationLanguages = async (
  c: Context,
  contentTypes: readonly RegisteredContentType[],
): Promise<void> => {
  bootCheck ??= assertContentLocalizationLanguages(c, contentTypes).catch(
    (error: unknown) => {
      bootCheck = undefined;
      throw error;
    },
  );

  await bootCheck;
};

/** Test seam: forgets the memoised boot check. */
export const resetContentLocalizationCheck = (): void => {
  bootCheck = undefined;
};

/**
 * The database handle a translation read or write should use.
 *
 * Shared with the base service's convention: `tx` when the caller owns a
 * transaction, the request's client otherwise.
 */
export const contentDatabase = (
  c: Context,
  tx?: ContentDatabase,
): ContentDatabase => tx ?? c.get("db");
