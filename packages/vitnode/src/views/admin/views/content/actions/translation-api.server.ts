"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type {
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
  parseContentTranslationConflict,
  parseContentUnprocessable,
} from "@/content/conflicts";

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
  error?: string;
  status?: number;
  unprocessable?: ContentUnprocessable;
}

const failure = (result: {
  error?: string;
  status: number;
}): TranslationMutationResult => ({
  conflict: parseContentTranslationConflict(result.error) ?? undefined,
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

/** One locale's presence and lifecycle, without its values. */
export interface TranslationMeta {
  locale: string;
  publishedAt?: null | string;
  status?: string;
  version: number;
}

/**
 * Which languages one record exists in.
 *
 * Metadata only, and one request for the whole strip: a tab bar needs to know
 * which locales are present and whether each is published, not to drag every
 * body in every language across the wire to find out. The panel loads one locale's
 * values when its tab is opened.
 */
export const listContentTranslationsAction = async (
  contentTypeId: string,
  id: number,
): Promise<{ edges: TranslationMeta[]; error?: string }> => {
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

  return { edges: result.data.edges as unknown as TranslationMeta[] };
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
): Promise<TranslationMutationResult> => {
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
};

export const editContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  values: Record<string, unknown>,
  expectedVersion: number,
): Promise<TranslationMutationResult> => {
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
};

export const deleteContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  expectedVersion: number,
): Promise<TranslationMutationResult> => {
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
};

const transition = async (
  action: "publish" | "unpublish",
  contentTypeId: string,
  id: number,
  locale: string,
  expectedVersion: number,
): Promise<TranslationMutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: { expectedVersion },
    definition,
    method: "post",
    path: `/${id}/translations/${segment(locale)}/${action}`,
    pluginId,
    schema: zodTranslationResult,
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

export const publishContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  expectedVersion: number,
): Promise<TranslationMutationResult> =>
  await transition("publish", contentTypeId, id, locale, expectedVersion);

export const unpublishContentTranslationAction = async (
  contentTypeId: string,
  id: number,
  locale: string,
  expectedVersion: number,
): Promise<TranslationMutationResult> =>
  await transition("unpublish", contentTypeId, id, locale, expectedVersion);

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
): Promise<TranslationMutationResult> => {
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
};
