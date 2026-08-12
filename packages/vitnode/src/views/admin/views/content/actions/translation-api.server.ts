"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type {
  ContentDeliveryConflict,
  ContentTranslationConflict,
  ContentUnprocessable,
} from "@/content/conflicts";
import type {
  ContentRevisionDetail,
  ContentRevisionMeta,
  ContentTranslationRevisionSnapshot,
} from "@/content/revisions";

import { findFrontendContentType } from "@/content/admin/config";
import { contentApiFetch } from "@/content/admin/fetch.server";
import {
  parseContentDeliveryConflict,
  parseContentTranslationConflict,
  parseContentUnprocessable,
} from "@/content/conflicts";

import {
  invalidateContentLocales,
  readContentPublicLocales,
} from "./public-locale-cache";

/**
 * The generic content screen ships from core, so its cached page path is the
 * catch-all route copied into every web app. Same constant the shared mutation
 * actions use; duplicated rather than exported, because a `"use server"` module
 * may only export async functions.
 */
const CONTENT_PAGE_PATH =
  "/[locale]/admin/(auth)/(plugins)/(vitnode-core)/content/[...slug]";

/**
 * What a translation mutation reports back.
 *
 * `conflict` is the interesting member and the reason this is not a boolean: the
 * locale editor has to tell "somebody else saved this Polish copy" from "that
 * Polish slug is taken" from "you cannot delete the default translation", and it
 * has to name the locale in each case so the right tab is highlighted.
 */
export interface TranslationMutationResult {
  conflict?: ContentTranslationConflict;
  /**
   * `CONTENT_DELIVERY_SLUG_RESERVED`, when a localized address is owned by another
   * record's URL history.
   *
   * Its own field rather than a sixth arm of `conflict`, because it is a fact about
   * *delivery* rather than about translations - the base routes answer with the same
   * shape, and one code for one condition is what lets the AdminCP say the same
   * sentence wherever the address was typed.
   */
  delivery?: ContentDeliveryConflict;
  error?: string;
  status?: number;
  unprocessable?: ContentUnprocessable;
}

const failure = (result: {
  error?: string;
  status: number;
}): TranslationMutationResult => ({
  conflict: parseContentTranslationConflict(result.error) ?? undefined,
  delivery: parseContentDeliveryConflict(result.error) ?? undefined,
  error: result.error ?? "",
  status: result.status,
  unprocessable: parseContentUnprocessable(result.error) ?? undefined,
});

const resolve = (contentTypeId: string) => {
  const entry = findFrontendContentType(contentTypeId);
  if (!entry) {
    throw new Error(`Unknown content type "${contentTypeId}".`);
  }

  return entry;
};

/**
 * The locale is a path segment, so it is encoded rather than interpolated raw.
 *
 * Belt and braces: the server resolves it against `core_languages` and answers
 * 404 for anything it does not recognise, so a crafted value cannot reach a
 * different record - but a `/` in a URL segment would change which *route*
 * matched, and that is worth closing here.
 */
const segment = (locale: string): string => encodeURIComponent(locale);

/** One translation as the routes return it: metadata plus nested `values`. */
const zodTranslation = z
  .object({
    itemId: z.number(),
    languageId: z.number(),
    locale: z.string(),
    values: z.record(z.string(), z.unknown()),
    version: z.number(),
  })
  .loose();

const zodTranslationList = z.object({
  edges: z.array(z.object({ locale: z.string() }).loose()),
});

const zodTranslationResult = z.object({
  changed: z.boolean(),
  row: zodTranslation,
});

const zodRevisionList = z.object({
  edges: z.array(z.object({ id: z.number() }).loose()),
  pageInfo: z.object({
    endCursor: z.number().nullable(),
    hasNextPage: z.boolean(),
  }),
});

/** One locale's row, as the tab strip and the panel read it. */
export interface TranslationRow {
  itemId: number;
  languageId: number;
  locale: string;
  publishedAt?: null | string;
  status?: string;
  values: Record<string, unknown>;
  version: number;
}

/**
 * The cache work one translation mutation owes, taken as a before-and-after pair.
 *
 * `changed: "translation"` narrows the fan-out to this locale - and, when the
 * content type falls back to the default *and this is the default locale*, to
 * every locale that has no translation of its own, because those are the pages
 * built from the row that just moved. A Polish edit expires Polish pages and
 * leaves the English cache warm.
 *
 * The snapshot is read on both sides rather than reasoned about, because whether
 * a locale has a page depends on the base row, its own translation and the
 * fallback - and that rule lives on the API, evaluated once.
 */
const withLocaleCache = async (
  contentTypeId: string,
  id: number,
  locale: string,
  mutate: () => Promise<TranslationMutationResult>,
): Promise<TranslationMutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);
  const before = await readContentPublicLocales(definition, pluginId, id);

  const result = await mutate();
  if (result.error !== undefined || result.conflict || result.unprocessable) {
    return result;
  }

  invalidateContentLocales(
    definition,
    id,
    before,
    await readContentPublicLocales(definition, pluginId, id),
    { changed: "translation", locale },
  );

  return result;
};

/** One locale's presence and lifecycle, without its values. */
export interface TranslationMeta {
  locale: string;
  publishedAt?: null | string;
  status?: string;
  version: number;
}

/**
 * Every language one record exists in, values included, in **one** request.
 *
 * What the edit form opens on. Its localized inputs each carry their own
 * language switcher, so they need the whole set up front - reading it language
 * by language would be one round trip per language to open one record.
 */
export const listContentTranslationsAction = async (
  contentTypeId: string,
  id: number,
): Promise<{ edges: TranslationRow[]; error?: string }> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/translations`,
    pluginId,
    schema: zodTranslationList,
  });

  if (result.status !== 200 || !result.data) {
    return { edges: [], error: result.error ?? "" };
  }

  return { edges: result.data.edges as unknown as TranslationRow[] };
};

export const getContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
): Promise<{ error?: string; row?: TranslationRow }> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/translations/${segment(locale)}`,
    pluginId,
    schema: zodTranslation,
  });

  // A missing translation is a 404 and not an error: "this locale has no
  // translation yet" is a state the tab renders as `Missing` with a create
  // action, and treating it as a failure would put a toast on an empty tab.
  if (result.status === 404) return {};
  if (result.status !== 200 || !result.data) {
    return { error: result.error ?? "" };
  }

  return { row: result.data as unknown as TranslationRow };
};

export const createContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  values: Record<string, unknown>,
): Promise<TranslationMutationResult> =>
  await withLocaleCache(contentTypeId, id, locale, async () => {
    const { definition, pluginId } = resolve(contentTypeId);

    const result = await contentApiFetch({
      body: { values },
      definition,
      method: "post",
      path: `/${id}/translations/${segment(locale)}`,
      pluginId,
      schema: zodTranslation,
    });

    if (result.status !== 201) return failure(result);

    revalidatePath(CONTENT_PAGE_PATH, "page");

    return {};
  });

export const editContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  values: Record<string, unknown>,
  expectedVersion: number,
): Promise<TranslationMutationResult> =>
  await withLocaleCache(contentTypeId, id, locale, async () => {
    const { definition, pluginId } = resolve(contentTypeId);

    const result = await contentApiFetch({
      body: { expectedVersion, values },
      definition,
      method: "put",
      path: `/${id}/translations/${segment(locale)}`,
      pluginId,
      schema: zodTranslationResult,
    });

    if (result.status !== 200) return failure(result);

    revalidatePath(CONTENT_PAGE_PATH, "page");

    return {};
  });

export const deleteContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  expectedVersion: number,
): Promise<TranslationMutationResult> =>
  await withLocaleCache(contentTypeId, id, locale, async () => {
    const { definition, pluginId } = resolve(contentTypeId);

    const result = await contentApiFetch({
      body: { expectedVersion },
      definition,
      method: "delete",
      path: `/${id}/translations/${segment(locale)}`,
      pluginId,
      schema: zodTranslation,
    });

    if (result.status !== 200) return failure(result);

    revalidatePath(CONTENT_PAGE_PATH, "page");

    return {};
  });

export interface TranslationRevisionPageResult {
  edges: ContentRevisionMeta[];
  error?: string;
  pageInfo: { endCursor: null | number; hasNextPage: boolean };
}

/** One locale's history. The cursor is the last **version** on the page. */
export const listContentTranslationRevisionsAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  cursor?: number,
): Promise<TranslationRevisionPageResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/translations/${segment(locale)}/revisions`,
    pluginId,
    query: cursor === undefined ? undefined : { cursor: String(cursor) },
    schema: zodRevisionList,
  });

  const empty = { endCursor: null, hasNextPage: false };

  if (result.status !== 200 || !result.data) {
    return { edges: [], error: result.error ?? "", pageInfo: empty };
  }

  return {
    edges: result.data.edges as unknown as ContentRevisionMeta[],
    pageInfo: result.data.pageInfo,
  };
};

export const getContentTranslationRevisionAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  revisionId: number,
): Promise<{
  error?: string;
  revision?: ContentRevisionDetail<ContentTranslationRevisionSnapshot>;
}> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/translations/${segment(locale)}/revisions/${revisionId}`,
    pluginId,
    schema: z.object({ id: z.number() }).loose(),
  });

  if (result.status !== 200 || !result.data) {
    return { error: result.error ?? "" };
  }

  return {
    revision:
      result.data as unknown as ContentRevisionDetail<ContentTranslationRevisionSnapshot>,
  };
};

export const restoreContentTranslationRevisionAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  revisionId: number,
  expectedVersion: number,
): Promise<TranslationMutationResult> =>
  await withLocaleCache(contentTypeId, id, locale, async () => {
    const { definition, pluginId } = resolve(contentTypeId);

    const result = await contentApiFetch({
      body: { expectedVersion },
      definition,
      method: "post",
      path: `/${id}/translations/${segment(locale)}/revisions/${revisionId}/restore`,
      pluginId,
      schema: zodTranslationResult,
    });

    if (result.status !== 200) return failure(result);

    revalidatePath(CONTENT_PAGE_PATH, "page");

    return {};
  });
