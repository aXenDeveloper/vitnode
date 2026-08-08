"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ContentPublicLocaleState } from "@/content/cache";
import type {
  ContentConflict,
  ContentDeliveryConflict,
  ContentScheduleRejection,
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
  parseContentUnprocessable,
} from "@/content/conflicts";
import { CONTENT_OPTIONS_LIMIT } from "@/content/const";
import { revalidateContent } from "@/content/next/revalidate.server";

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
  /** Why a schedule was refused, when the API said. */
  rejection?: ContentScheduleRejection;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;
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
      ...deliveryInvalidationFor(definition, previous, current),
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
 * `{}` for a content type without `delivery`, so spreading it leaves the input -
 * and therefore the tag list - exactly as it was. A sitemap line is added, removed
 * or moved when public reachability changed or when the URL did, which is the same
 * rule `applyContentDeliveryWrite` reports from inside the transaction; stated twice
 * because the Server Action cannot see the outcome, only the two rows.
 */
const deliveryInvalidationFor = (
  definition: AnyContentTypeDefinition,
  previous: { isPublic: boolean; slug: string },
  current: { isPublic: boolean; slug: string },
): { delivery?: { sitemap: boolean } } =>
  definition.delivery.enabled
    ? {
        delivery: {
          sitemap:
            previous.isPublic !== current.isPublic ||
            (previous.slug !== "" &&
              current.slug !== "" &&
              previous.slug !== current.slug),
        },
      }
    : {};

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

  return {};
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
 * because only the definition knows whether the install has a preview page
 * (`preview.pathTemplate`) or should link at the JSON endpoint.
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

    revalidateContent(
      {
        contentTypeId: definition.id,
        // The sitemap has lost a line whenever the record had one, which is exactly
        // "was it ever published" - the same question the `wasPublic` below asks.
        ...(definition.delivery.enabled
          ? { delivery: { sitemap: result.data?.publishedAt != null } }
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
        // A real transition always adds or removes a sitemap line.
        ...(definition.delivery.enabled ? { delivery: { sitemap: true } } : {}),
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
