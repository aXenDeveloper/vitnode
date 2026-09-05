import { z } from "zod";

import type { ContentPublicationAction } from "@/content/publication";

import { CONTENT_OPTIONS_LIMIT } from "@/content/const";

import type {
  ContentMutationResult,
  ContentRowResult,
  ContentTranslationInput,
  TranslationRow,
} from "../content-mutation";
import type { ContentApiTarget } from "../content-request";
import type { ContentOption } from "../lib/field-component";

import {
  contentFailureResult as failure,
  sendContentApiRequest as send,
  contentWriteSucceeded as succeeded,
  contentVersionOf as versionOf,
} from "../lib/api-result";

/** Anything the generated routes return: an identifier plus the row's fields. */
const zodRow = z.object({ id: z.number() }).loose();

const zodPublicationResult = z.object({ changed: z.boolean(), row: zodRow });

const zodTranslationList = z.object({
  edges: z.array(z.object({ locale: z.string() }).loose()),
});

const zodOptions = z.object({
  items: z.array(
    z.object({
      avatarColor: z.string().optional(),
      color: z.string().optional(),
      label: z.string(),
      nameCode: z.string().optional(),
      value: z.number(),
    }),
  ),
});

const readTranslations = async (
  target: ContentApiTarget,
  id: number,
): Promise<TranslationRow[]> => {
  const result = await send(
    { method: "get", path: `/${id}/translations`, target },
    zodTranslationList,
  );

  return (result.data?.edges ?? []) as unknown as TranslationRow[];
};

export const createContentInBrowser = async (
  target: ContentApiTarget,
  values: Record<string, unknown>,
): Promise<ContentMutationResult> => {
  const result = await send({ body: values, method: "post", target }, zodRow);

  if (!succeeded(result, 201)) return failure(result);

  return { id: result.data?.id ?? 0 };
};

export const editContentInBrowser = async (
  target: ContentApiTarget,
  {
    editorial,
    expectedVersion,
    id,
    values,
  }: {
    /** Whether this content type's `PUT` takes a precondition at all. */
    editorial: boolean;
    expectedVersion?: number;
    id: number;
    values: Record<string, unknown>;
  },
): Promise<ContentMutationResult> => {
  const result = await send(
    {
      body: editorial ? { expectedVersion, values } : values,
      method: "put",
      path: `/${id}`,
      target,
    },
    zodRow,
  );

  if (!succeeded(result, 200)) return failure(result);

  return { version: versionOf(result.data) };
};

/**
 * Creates a record **and** its translations, in one transaction.
 *
 * The AdminCP form has one Save button and no locale of its own, so the values
 * of every language the editor typed into arrive together. The engine's
 * invariant - a record exists in at least its default language or it does not
 * exist at all - is enforced server-side, which is why this is one route rather
 * than a create followed by N writes that could each fail on their own.
 */
export const createLocalizedContentInBrowser = async (
  target: ContentApiTarget,
  values: Record<string, unknown>,
  translations: ContentTranslationInput[],
): Promise<ContentMutationResult> => {
  const result = await send(
    {
      body: { translations, values },
      method: "post",
      path: "/localized",
      target,
    },
    zodRow,
  );

  if (!succeeded(result, 201)) return failure(result);

  const created = result.data?.id ?? 0;

  return {
    id: created,
    translations: await readTranslations(target, created),
  };
};

/**
 * Saves the shared fields and every changed language, in one transaction.
 *
 * `values` is `undefined` when no shared field moved, and a language appears
 * only when something in it moved - so a Polish-only edit bumps the Polish
 * version and nothing else: no base revision, no English event, no English cache
 * expiry.
 */
export const editLocalizedContentInBrowser = async (
  target: ContentApiTarget,
  {
    expectedVersion,
    id,
    translations,
    values,
  }: {
    expectedVersion?: number;
    id: number;
    translations: ContentTranslationInput[];
    values: Record<string, unknown> | undefined;
  },
): Promise<ContentMutationResult> => {
  if (values === undefined && translations.length === 0) {
    // Nothing moved. Saying so costs one round trip less than proving it again
    // on the server - and the caller is told, so the screen says "no changes"
    // rather than "saved".
    return { unchanged: true };
  }

  const result = await send(
    {
      body: {
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        translations,
        ...(values === undefined ? {} : { values }),
      },
      method: "put",
      path: `/${id}/localized`,
      target,
    },
    zodRow,
  );

  if (!succeeded(result, 200)) return failure(result);

  return {
    translations: await readTranslations(target, id),
    version: versionOf(result.data),
  };
};

/**
 * Publishing and unpublishing share one shape, so they share one call.
 *
 * Both routes are idempotent: publishing something already published is a `200`
 * with `changed: false`, not an error. The button therefore never has to guard
 * against a double click, and a stale row in the table resolves itself.
 */
export const setContentPublishedInBrowser = async (
  target: ContentApiTarget,
  id: number,
  action: ContentPublicationAction,
): Promise<ContentMutationResult> => {
  const result = await send(
    { method: "post", path: `/${id}/${action}`, target },
    zodPublicationResult,
  );

  if (!succeeded(result, 200)) return failure(result);

  return { version: versionOf(result.data?.row) };
};

/** Re-reads one record - for the conflict banner and for missing collections. */
export const readContentRowInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<ContentRowResult> => {
  const result = await send({ method: "get", path: `/${id}`, target }, zodRow);

  if (!succeeded(result, 200)) return { error: result.error ?? "" };

  return { row: result.data };
};

/** Every language one record exists in, values included, in one request. */
export const listContentTranslationsInBrowser = async (
  target: ContentApiTarget,
  id: number,
): Promise<{ edges: TranslationRow[]; error?: string }> => {
  const result = await send(
    { method: "get", path: `/${id}/translations`, target },
    zodTranslationList,
  );

  if (!succeeded(result, 200) || !result.data) {
    return { edges: [], error: result.error ?? "" };
  }

  return { edges: result.data.edges as unknown as TranslationRow[] };
};

/**
 * Backs the `relation` and `user` pickers.
 *
 * Gated by the content type's own `can_view` rather than by a permission on the
 * target table, which is why a `user` field reads its people from here rather
 * than from the members list: an editor who may write articles can pick an
 * author without also being trusted to browse the member list.
 */
export const loadContentOptionsInBrowser = async (
  target: ContentApiTarget,
  field: string,
  search: string,
  ids?: number[],
): Promise<ContentOption[]> => {
  const result = await send(
    {
      method: "get",
      path: `/options/${encodeURIComponent(field)}`,
      query: ids ? { ids: ids.join(",") } : { search },
      target,
    },
    zodOptions,
  );

  return (
    (result.data?.items ?? [])
      // A label lookup is bounded by the identifiers the caller sent, which is
      // already a number the form is holding - the limit is for a search.
      .slice(0, ids ? ids.length : CONTENT_OPTIONS_LIMIT)
      // Spread rather than rebuilt key by key: the only thing this mapping is
      // for is turning the identifier into a string, and a hand-listed object
      // silently drops whatever the option grows next.
      .map(item => ({ ...item, value: String(item.value) }))
  );
};
