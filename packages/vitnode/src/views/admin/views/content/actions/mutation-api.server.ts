"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ContentInvalidationMode } from "@/content/next/revalidate.server";
import type { AnyContentTypeDefinition } from "@/content/types";

import { findFrontendContentType } from "@/content/admin/config";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { isContentPubliclyVisible } from "@/content/cache";
import { CONTENT_OPTIONS_LIMIT } from "@/content/const";
import { revalidateContent } from "@/content/next/revalidate.server";

/**
 * The generic content screen ships from core, so its cached page path is the
 * catch-all route copied into every web app.
 */
const CONTENT_PAGE_PATH =
  "/[locale]/admin/(auth)/(plugins)/(vitnode-core)/content/[...slug]";

interface MutationResult {
  error?: string;
  /** Lets the UI tell a restricted delete (409) from a generic failure. */
  status?: number;
}

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
): void => {
  if (!definition.publicApi.enabled) return;

  const previous = publicStateOf(definition, before);
  const current = publicStateOf(definition, after);

  revalidateContent(
    {
      contentTypeId: definition.id,
      id,
      isPublic: current.isPublic,
      // Both, so a slug change stops the old URL and starts the new one.
      slugs: [previous.slug, current.slug],
      wasPublic: previous.isPublic,
    },
    { mode: modeFor(previous, current) },
  );
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

  if (result.status !== 201) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");
  // A new row starts as a draft, so this normally invalidates nothing at all -
  // it is computed rather than assumed, so the rule holds if that changes.
  invalidate(definition, result.data?.id ?? 0, undefined, result.data);

  return {};
};

export const editContentAction = async (
  contentTypeId: string,
  id: number,
  values: Record<string, unknown>,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  // Before the write, so a slug change can invalidate the URL it replaced.
  const before = await readRow(definition, pluginId, id);

  const result = await contentApiFetch({
    body: values,
    definition,
    method: "put",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");
  invalidate(definition, id, before, result.data);

  return {};
};

export const deleteContentAction = async (
  contentTypeId: string,
  id: number,
): Promise<MutationResult> => {
  const { definition, pluginId } = resolve(contentTypeId);

  const result = await contentApiFetch({
    definition,
    method: "delete",
    path: `/${id}`,
    pluginId,
    schema: zodRow,
  });

  if (result.status !== 200) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");

  if (definition.publicApi.enabled) {
    // A delete is final, so the question is "was it ever published?" rather
    // than "was it live a second ago". `publishedAt` survives an unpublish, and
    // expiring a URL that is now gone forever costs nothing.
    revalidateContent(
      {
        contentTypeId: definition.id,
        id,
        isPublic: false,
        slugs: [publicStateOf(definition, result.data).slug],
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

  const result = await contentApiFetch({
    definition,
    method: "post",
    path: `/${id}/${action}`,
    pluginId,
    schema: zodPublicationResult,
  });

  if (result.status !== 200) {
    return { error: result.error ?? "", status: result.status };
  }

  revalidatePath(CONTENT_PAGE_PATH, "page");

  // A no-op transitioned nothing, so nothing public went stale. Expiring a tag
  // on every button press would throw away a warm cache for free.
  if (result.data?.changed && definition.publicApi.enabled) {
    const { isPublic, slug } = publicStateOf(definition, result.data.row);

    revalidateContent(
      {
        contentTypeId: definition.id,
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
