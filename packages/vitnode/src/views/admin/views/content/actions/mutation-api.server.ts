"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ContentPublicLocaleState } from "@/content/cache";
import type { ContentDeliveryInvalidation } from "@/content/cache";
import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentScheduleRejection,
  ContentTranslationConflict,
  ContentUnprocessable,
} from "@/content/conflicts";
import type { ContentInvalidationMode } from "@/content/next/revalidate.server";
import type {
  ContentRevisionDetail,
  ContentRevisionMeta,
} from "@/content/revisions";
import type {
  ContentSchedule,
  ContentScheduleAction,
} from "@/content/schedules";
import type { AnyContentTypeDefinition } from "@/content/types";

import { findFrontendContentType } from "@/content/admin/config";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { isContentPubliclyVisible } from "@/content/cache";
import {
  parseContentConflict,
  parseContentDeliveryConflict,
  parseContentScheduleRejection,
  parseContentTranslationConflict,
  parseContentUnprocessable,
} from "@/content/conflicts";
import { CONTENT_OPTIONS_LIMIT } from "@/content/const";
import { revalidateContent } from "@/content/next/revalidate.server";

import type { TranslationRow } from "./translation-api.server";

import {
  invalidateContentLocales,
  readContentPublicLocales,
} from "./public-locale-cache";

/**
 * The generic content screen ships from core, so its cached page path is the
 * catch-all route copied into every web app.
 */
const CONTENT_PAGE_PATH =
  "/[locale]/admin/(auth)/(plugins)/(vitnode-core)/content/[...slug]";

interface MutationResult {
  /**
   * The structured reason an editorial write was refused, when the API sent
   * one. `CONTENT_VERSION_CONFLICT` is the interesting case: the dialog reloads
   * the newer record and offers to overwrite it, which it cannot do from a
   * sentence.
   */
  conflict?: ContentConflict;
  /**
   * `CONTENT_DELIVERY_SLUG_RESERVED`, naming the address and its locale.
   *
   * Its own field rather than a third arm of `conflict`, because the two share a
   * status and need different words: a unique clash is "another record holds that
   * address now", and this is "another record used to hold it and it still
   * redirects there".
   */
  delivery?: ContentDeliveryConflict;
  error?: string;
  /**
   * The identifier of a newly created record.
   *
   * Only set by `createContentAction`, and only on success - a page-mode create
   * navigates to the record's own edit page, and guessing at the id would open
   * the wrong one.
   */
  id?: number;
  /** Why a schedule was refused, when the API said. */
  rejection?: ContentScheduleRejection;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;
  /**
   * The same, for the language half of a composite save.
   *
   * Its own field rather than a second arm of `conflict`, because the two need
   * different words and point at different things: one says the record moved,
   * the other says one language of it did - and names which.
   */
  translationConflict?: ContentTranslationConflict;
  /**
   * Every translation as it stands **after** a composite save.
   *
   * The form keeps editing after a page-mode save, and its next save needs each
   * language's new version - reusing the ones it opened with would lose to the
   * write it just made.
   */
  translations?: TranslationRow[];
  /** `CONTENT_REVISION_NOT_RESTORABLE`, naming the fields that no longer fit. */
  unprocessable?: ContentUnprocessable;
}

/** Reads whatever structured error the API sent, if any. */
const failure = (result: {
  error?: string;
  status: number;
}): MutationResult => ({
  conflict: parseContentConflict(result.error) ?? undefined,
  delivery: parseContentDeliveryConflict(result.error) ?? undefined,
  error: result.error ?? "",
  rejection: parseContentScheduleRejection(result.error) ?? undefined,
  status: result.status,
  translationConflict:
    parseContentTranslationConflict(result.error) ?? undefined,
  unprocessable: parseContentUnprocessable(result.error) ?? undefined,
});

const resolve = (contentTypeId: string) => {
  const entry = findFrontendContentType(contentTypeId);
  if (!entry) {
    throw new Error(`Unknown content type "${contentTypeId}".`);
  }

  return entry;
};

/** Anything the generated routes return: an identifier plus the row's fields. */
const zodRow = z.object({ id: z.number() }).loose();

const zodPublicationResult = z.object({ changed: z.boolean(), row: zodRow });

type ContentRow = z.infer<typeof zodRow>;

/**
 * Where a row sits relative to the public API, read off a mutation response.
 *
 * `isContentPubliclyVisible` is the JavaScript half of `publishedCondition`, so
 * "was this reachable?" is answered by the same three clauses the database
 * enforces rather than by a second, drifting rule.
 */
const publicStateOf = (
  definition: AnyContentTypeDefinition,
  row?: ContentRow,
) => {
  const slug = row?.[definition.publicApi.slugField];

  return {
    isPublic: isContentPubliclyVisible({
      publishedAt: row?.publishedAt as Date | null | string | undefined,
      status: row?.status as string | undefined,
    }),
    slug: typeof slug === "string" ? slug : "",
  };
};

/**
 * Reads a row *before* a write, so an update knows the slug it is about to
 * replace.
 *
 * Deliberately a read rather than a guess: the generated `PUT` returns the new
 * row, and by then the old URL is gone. Widening the route's response to carry
 * the previous row would change a public contract for a cache concern, and
 * trusting the slug the browser happens to be holding would invalidate the
 * wrong tag whenever the table was stale. One extra `GET` on a staff edit of a
 * *public* content type is the cheapest correct option - it is skipped
 * entirely for everything else.
 */
const readRow = async (
  definition: AnyContentTypeDefinition,
  pluginId: string,
  id: number,
): Promise<ContentRow | undefined> => {
  if (!definition.publicApi.enabled) return undefined;

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  return result.data;
};

type PublicState = ReturnType<typeof publicStateOf>;

/**
 * Stale-while-revalidate is safe in exactly one case: the row was public
 * before, is public after, and still answers to the same URL. The response that
 * may be served one more time is then one a visitor is allowed to see and can
 * still reach - it is simply a few seconds out of date, and keeping the cache
 * warm is worth more than that.
 *
 * Everything else *removes* public reachability. An unpublish, a delete or a
 * slug change must not serve the old response even once, so those expire
 * immediately.
 */
const modeFor = (
  previous: PublicState,
  current: PublicState,
): ContentInvalidationMode =>
  previous.isPublic && current.isPublic && previous.slug === current.slug
    ? "stale-while-revalidate"
    : "immediate";

/** Expires the public cache entries this mutation actually affected. */
const invalidate = (
  definition: AnyContentTypeDefinition,
  id: number,
  before: ContentRow | undefined,
  after: ContentRow | undefined,
  locales?: {
    after: readonly ContentPublicLocaleState[];
    before: readonly ContentPublicLocaleState[];
  },
): void => {
  if (!definition.publicApi.enabled) return;

  if (definition.localization.enabled) {
    // Without a snapshot pair there is nothing honest to expire, and expiring
    // tags that name pages which do not exist is worse than leaving them.
    if (locales) {
      invalidateContentLocales(definition, id, locales.before, locales.after);
    }

    return;
  }

  const previous = publicStateOf(definition, before);
  const current = publicStateOf(definition, after);

  revalidateContent(
    {
      contentTypeId: definition.id,
      ...deliveryInvalidationFor(definition, before, after, previous, current),
      id,
      isPublic: current.isPublic,
      // Both, so a slug change stops the old URL and starts the new one.
      slugs: [previous.slug, current.slug],
      wasPublic: previous.isPublic,
    },
    { mode: modeFor(previous, current) },
  );
};

/**
 * The delivery half of a nonlocalized mutation's invalidation.
 *
 * `{}` for a content type without `delivery`, so spreading it leaves the input - and
 * therefore the tag list - exactly as it was.
 *
 * `contentChanged` is decided by comparing `updatedAt` across the write, which is not
 * a proxy for "did the sitemap change" but *the value the sitemap serializes*: a
 * sitemap entry's `<lastmod>` is `base.updatedAt`, so the two move together by
 * construction. It also answers "was this a no-op" for free - the engine issues no
 * `UPDATE` for an update that changed nothing, so the timestamp does not move and the
 * cached sitemap is still correct.
 *
 * `indexChanged` is public reachability flipping, and nothing else: an index lists
 * files and counts URLs, so a slug change or a title edit leaves it alone.
 */
const deliveryInvalidationFor = (
  definition: AnyContentTypeDefinition,
  before: ContentRow | undefined,
  after: ContentRow | undefined,
  previous: { isPublic: boolean },
  current: { isPublic: boolean },
): { delivery?: ContentDeliveryInvalidation } => {
  if (!definition.delivery.enabled) return {};

  const reachable = previous.isPublic || current.isPublic;

  return {
    delivery: {
      sitemap: {
        contentChanged: reachable && timestampMoved(before, after),
        indexChanged: previous.isPublic !== current.isPublic,
      },
    },
  };
};

/**
 * Whether `updatedAt` moved across a write.
 *
 * `true` when either side is missing - a create or a delete - because the record
 * appeared or disappeared and there is no pair to compare. Unparseable values are
 * treated the same way: a cached sitemap that might be stale is worse than a cache
 * miss.
 */
const timestampMoved = (
  before: ContentRow | undefined,
  after: ContentRow | undefined,
): boolean => {
  const at = (row: ContentRow | undefined): null | number => {
    const value = row?.updatedAt;
    if (value instanceof Date) return value.getTime();
    if (typeof value !== "string") return null;

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? null : parsed;
  };

  const first = at(before);
  const second = at(after);

  return first === null || second === null || first !== second;
};

export const createContentAction = async (
  contentTypeId: string,
  values: Record<string, unknown>,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: values,
    definition,
    method: "post",
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 201) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");
  const created = result.data?.id ?? 0;
  // A new row starts as a draft, so this normally invalidates nothing at all -
  // it is computed rather than assumed, so the rule holds if that changes. The
  // "before" side is empty because the record did not exist.
  invalidate(definition, created, undefined, result.data, {
    after: await readContentPublicLocales(definition, pluginId, created),
    before: [],
  });

  return { id: created };
};

export const editContentAction = async (
  contentTypeId: string,
  id: number,
  values: Record<string, unknown>,
  /**
   * The version the editor started from. Required by an editorial content type
   * and ignored by every other one, so the form can pass it unconditionally.
   */
  expectedVersion?: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  // Before the write, so a slug change can invalidate the URL it replaced.
  const before = await readRow(definition, pluginId, id);
  const localesBefore = await readContentPublicLocales(
    definition,
    pluginId,
    id,
  );

  const result = await contentApiFetch({
    body: definition.editorial.enabled ? { expectedVersion, values } : values,
    definition,
    method: "put",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");
  invalidate(definition, id, before, result.data, {
    after: await readContentPublicLocales(definition, pluginId, id),
    before: localesBefore,
  });

  return {};
};

/** One language's half of a composite save, as the form assembled it. */
export interface ContentTranslationInput {
  /** Absent when this language had no translation when the form opened. */
  expectedVersion?: number;
  locale: string;
  values: Record<string, unknown>;
}

/**
 * Reads every translation back after a composite save.
 *
 * One request for the whole set, so a form that stays open (page mode) holds the
 * versions the next save has to send. Failing quietly is right here: the write
 * has committed, and a stale version only costs one conflict banner.
 */
const readTranslations = async (
  definition: AnyContentTypeDefinition,
  pluginId: string,
  id: number,
): Promise<TranslationRow[]> => {
  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/translations`,
    pluginId,
    schema: z.object({
      edges: z.array(z.object({ locale: z.string() }).loose()),
    }),
  });

  return (result.data?.edges ?? []) as unknown as TranslationRow[];
};

/**
 * Creates a record **and** its translations, in one transaction.
 *
 * The AdminCP form has one Save button and no locale of its own, so the values
 * of every language the editor typed into arrive together. The invariant the
 * engine has always had is unchanged and enforced server-side: a record exists
 * in at least its default language or it does not exist at all - which is why
 * this is one route and not a create followed by N translation writes that could
 * each fail on their own.
 */
export const createLocalizedContentAction = async (
  contentTypeId: string,
  values: Record<string, unknown>,
  translations: ContentTranslationInput[],
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: { translations, values },
    definition,
    method: "post",
    path: "/localized",
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 201) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");
  const created = result.data?.id ?? 0;
  invalidate(definition, created, undefined, result.data, {
    after: await readContentPublicLocales(definition, pluginId, created),
    before: [],
  });

  return {
    id: created,
    translations: await readTranslations(definition, pluginId, created),
  };
};

/**
 * Saves the shared fields and every changed language, in one transaction.
 *
 * `values` is `undefined` when no shared field moved, and a language appears
 * only when something in it moved - so a Polish-only edit bumps the Polish
 * version and nothing else: no base revision, no English event, no English cache
 * expiry. Each entry carries the version it was loaded at, so two translators in
 * two languages never contend, and a stale one is refused for that language
 * *before anything commits*.
 */
export const editLocalizedContentAction = async (
  contentTypeId: string,
  id: number,
  values: Record<string, unknown> | undefined,
  translations: ContentTranslationInput[],
  expectedVersion?: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  if (values === undefined && translations.length === 0) {
    // Nothing moved. Saying so costs one round trip less than proving it again
    // on the server, and the toast is the same either way.
    return {};
  }

  const before = await readRow(definition, pluginId, id);
  const localesBefore = await readContentPublicLocales(
    definition,
    pluginId,
    id,
  );

  const result = await contentApiFetch({
    body: {
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
      translations,
      ...(values === undefined ? {} : { values }),
    },
    definition,
    method: "put",
    path: `/${id}/localized`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");
  invalidate(definition, id, before, result.data, {
    after: await readContentPublicLocales(definition, pluginId, id),
    before: localesBefore,
  });

  return { translations: await readTranslations(definition, pluginId, id) };
};

/**
 * Re-reads one record, for the conflict banner.
 *
 * Deliberately not a full page refresh: the dialog is still open with the
 * editor's unsaved values in it, and `router.refresh()` would remount the form
 * and throw them away - which is the one thing the conflict flow must not do.
 */
export const reloadContentRowAction = async (
  contentTypeId: string,
  id: number,
): Promise<{ error?: string; row?: ContentRow }> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) return { error: result.error ?? "" };

  return { row: result.data };
};

const zodRevisionList = z.object({
  edges: z.array(z.object({ id: z.number() }).loose()),
  pageInfo: z.object({
    endCursor: z.number().nullable(),
    hasNextPage: z.boolean(),
  }),
});

export interface ContentRevisionPageResult {
  edges: ContentRevisionMeta[];
  error?: string;
  pageInfo: { endCursor: null | number; hasNextPage: boolean };
}

/**
 * One page of history. Metadata only - snapshots load one at a time.
 *
 * The cursor is the last **version** on the previous page and the route is
 * exclusive on it, so pages append cleanly and never repeat their boundary row.
 */
export const listContentRevisionsAction = async (
  contentTypeId: string,
  id: number,
  cursor?: number,
): Promise<ContentRevisionPageResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/revisions`,
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

export const getContentRevisionAction = async (
  contentTypeId: string,
  id: number,
  revisionId: number,
): Promise<{ error?: string; revision?: ContentRevisionDetail }> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/revisions/${revisionId}`,
    pluginId,
    schema: z.object({ id: z.number() }).loose(),
  });

  if (result.status !== 200) return { error: result.error ?? "" };

  return { revision: result.data as unknown as ContentRevisionDetail };
};

/**
 * Restores one revision, and reports the version the record now holds.
 *
 * The version comes back because the history dialog stays open afterwards: its
 * next restore needs the *new* precondition, and reusing the one it opened with
 * would fail with a conflict against the restore it just performed.
 */
export const restoreContentRevisionAction = async (
  contentTypeId: string,
  id: number,
  revisionId: number,
  expectedVersion: number,
): Promise<MutationResult & { version?: number }> => {
  const { definition, pluginId } = resolve(contentTypeId);

  // Same as an edit: the old slug has to be known before the write, or a
  // restore that moves the URL leaves the previous one resolving.
  const before = await readRow(definition, pluginId, id);
  const localesBefore = await readContentPublicLocales(
    definition,
    pluginId,
    id,
  );

  const result = await contentApiFetch({
    body: { expectedVersion },
    definition,
    method: "post",
    path: `/${id}/revisions/${revisionId}/restore`,
    pluginId,
    schema: z.object({ changed: z.boolean(), row: zodRow }),
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");
  // A restore never moves `status`, so visibility is unchanged - but the slug
  // may have, and `invalidate` compares both rows to work out which.
  invalidate(definition, id, before, result.data?.row, {
    after: await readContentPublicLocales(definition, pluginId, id),
    before: localesBefore,
  });

  const version = result.data?.row.version;

  return { version: typeof version === "number" ? version : undefined };
};

export interface ContentPreviewLink {
  expiresAt: string;
  revisionId: number;
  url: string;
  version: number;
}

/**
 * Mints a preview link, on the click and not before.
 *
 * Nothing here is cached or revalidated: no row changed, and a token is a
 * short-lived bearer credential for an unpublished record. Handing one to every
 * row of the table "just in case" would mean a page of live credentials sitting
 * in a browser, most of them never used.
 *
 * The `url` comes back from the server rather than being assembled here,
 * because only the server knows which of the three it should be: a dedicated
 * preview page (`preview.pathTemplate`), the record's own canonical page
 * carrying `?preview=`, or the JSON endpoint when there is no page at all. The
 * middle one needs the record's slug, which is not on this side either.
 */
export const createContentPreviewAction = async (
  contentTypeId: string,
  id: number,
): Promise<{
  error?: string;
  preview?: ContentPreviewLink;
  status?: number;
}> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "post",
    path: `/${id}/preview`,
    pluginId,
    schema: z.object({
      expiresAt: z.string(),
      revisionId: z.number(),
      token: z.string(),
      url: z.string(),
      version: z.number(),
    }),
  });

  if (result.status !== 200 || !result.data) {
    return { error: result.error ?? "", status: result.status };
  }

  const { expiresAt, revisionId, url, version } = result.data;

  // The token itself is deliberately not returned: it is already inside `url`,
  // and a second copy is a second thing to leak.
  return { preview: { expiresAt, revisionId, url, version } };
};

export const listContentSchedulesAction = async (
  contentTypeId: string,
  id: number,
): Promise<{
  edges: ContentSchedule[];
  error?: string;
  hasCronAdapter: boolean;
}> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${id}/schedules`,
    pluginId,
    schema: z.object({
      edges: z.array(z.object({ id: z.number() }).loose()),
      hasCronAdapter: z.boolean(),
    }),
  });

  if (result.status !== 200) {
    return { edges: [], error: result.error ?? "", hasCronAdapter: true };
  }

  return {
    edges: (result.data?.edges ?? []) as unknown as ContentSchedule[],
    hasCronAdapter: result.data?.hasCronAdapter ?? true,
  };
};

/**
 * Books a publication or an unpublication for later.
 *
 * Nothing public changes yet, so no cache tag is expired - only the admin table
 * is refreshed, because it now shows a pending badge. The transition itself
 * invalidates the cache when it fires, over the
 * [revalidation bridge](/docs/dev/content-engine/scheduling).
 */
export const scheduleContentAction = async (
  contentTypeId: string,
  id: number,
  action: ContentScheduleAction,
  scheduledFor: string,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    body: { action, scheduledFor },
    definition,
    method: "post",
    path: `/${id}/schedule`,
    pluginId,
    schema: z.object({ id: z.number() }),
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

export const cancelContentScheduleAction = async (
  contentTypeId: string,
  id: number,
  scheduleId: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "post",
    path: `/${id}/schedule/${scheduleId}/cancel`,
    pluginId,
    schema: z.object({ cancelled: z.boolean() }),
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");

  return {};
};

export const deleteContentAction = async (
  contentTypeId: string,
  id: number,
  /**
   * The version the row showed when the person clicked delete. Required by an
   * editorial content type and ignored by every other one, so the table can
   * pass it unconditionally.
   */
  expectedVersion?: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  // Before the write, because afterwards there is no record left to ask which
  // languages it had pages in.
  const localesBefore = await readContentPublicLocales(
    definition,
    pluginId,
    id,
  );

  const result = await contentApiFetch({
    // A body on a `DELETE`, matching the route: the precondition travels with
    // the request that acts on it rather than in a query string that ends up in
    // access logs.
    body: definition.editorial.enabled ? { expectedVersion } : undefined,
    definition,
    method: "delete",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");

  // Every language loses its page at once, so the "after" side is empty rather
  // than re-read - there is nothing left to read.
  if (definition.localization.enabled) {
    invalidateContentLocales(definition, id, localesBefore, []);
  } else if (definition.publicApi.enabled) {
    // A delete is final, so the question is "was it ever published?" rather
    // than "was it live a second ago". `publishedAt` survives an unpublish, and
    // expiring a URL that is now gone forever costs nothing.
    const removed = publicStateOf(definition, result.data);

    const wasEverPublic = result.data?.publishedAt != null;

    revalidateContent(
      {
        contentTypeId: definition.id,
        // A delete removes a line from the file and one URL from the index's count,
        // whenever the record had one - which is exactly "was it ever published".
        ...(definition.delivery.enabled
          ? {
              delivery: {
                sitemap: {
                  contentChanged: wasEverPublic,
                  indexChanged: wasEverPublic,
                },
              },
            }
          : {}),
        id,
        isPublic: false,
        slugs: [removed.slug],
        wasPublic: result.data?.publishedAt != null,
      },
      // The row is gone. Serving its cached response one more time would be a
      // 200 for something that no longer exists.
      { mode: "immediate" },
    );
  }

  return {};
};

/**
 * Publishing and unpublishing share one shape, so they share one call.
 *
 * Both routes are idempotent: publishing something already published is a 200
 * with `changed: false`, not an error. The button therefore never has to guard
 * against a double click, and a stale row in the table resolves itself.
 */
const publicationAction = async (
  contentTypeId: string,
  id: number,
  action: "publish" | "unpublish",
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  // Before the write, because a transition of the record moves every language
  // it has a page in, and afterwards only the new side is readable.
  const localesBefore = await readContentPublicLocales(
    definition,
    pluginId,
    id,
  );

  const result = await contentApiFetch({
    definition,
    method: "post",
    path: `/${id}/${action}`,
    pluginId,
    schema: zodPublicationResult,
  });

  if (result.status !== 200) return failure(result);

  revalidatePath(CONTENT_PAGE_PATH, "page");

  // A no-op transitioned nothing, so nothing public went stale. Expiring a tag
  // on every button press would throw away a warm cache for free.
  if (result.data?.changed && definition.localization.enabled) {
    invalidateContentLocales(
      definition,
      id,
      localesBefore,
      await readContentPublicLocales(definition, pluginId, id),
    );
  } else if (result.data?.changed && definition.publicApi.enabled) {
    const { isPublic, slug } = publicStateOf(definition, result.data.row);

    revalidateContent(
      {
        contentTypeId: definition.id,
        // A real transition flips reachability, so it moves both the file and the
        // index that counts its URLs.
        ...(definition.delivery.enabled
          ? {
              delivery: {
                sitemap: { contentChanged: true, indexChanged: true },
              },
            }
          : {}),
        id,
        isPublic,
        slugs: [slug],
        // A real transition flips visibility by definition.
        wasPublic: !isPublic,
      },
      // Both directions are immediate. Unpublishing must not leave the post
      // readable for one more request, and publishing should be visible the
      // moment the success toast appears rather than on the request after it.
      { mode: "immediate" },
    );
  }

  return {};
};

export const publishContentAction = async (
  contentTypeId: string,
  id: number,
): Promise<MutationResult> =>
  await publicationAction(contentTypeId, id, "publish");

export const unpublishContentAction = async (
  contentTypeId: string,
  id: number,
): Promise<MutationResult> =>
  await publicationAction(contentTypeId, id, "unpublish");

const zodOptions = z.object({
  items: z.array(z.object({ label: z.string(), value: z.number() })),
});

/**
 * Backs the `relation` and `user` pickers.
 *
 * A server action rather than a client fetch, so the browser never needs the
 * API origin and the request is gated by the content type's own `can_view`
 * instead of a separate permission on the target table.
 */
export const loadContentOptionsAction = async (
  contentTypeId: string,
  field: string,
  search: string,
): Promise<{ label: string; value: string }[]> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/options/${field}`,
    pluginId,
    query: { search },
    schema: zodOptions,
  });

  return (result.data?.items ?? [])
    .slice(0, CONTENT_OPTIONS_LIMIT)
    .map(item => ({ label: item.label, value: String(item.value) }));
};
