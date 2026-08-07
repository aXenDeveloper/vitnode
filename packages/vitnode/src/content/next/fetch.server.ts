import "server-only";
import type { z } from "zod";

import type {
  AnyContentTypeDefinition,
  PreviewableContentTypeDefinition,
  PublicContentTypeDefinition,
} from "../types";

import { rawApiFetch } from "../../lib/fetcher/raw";
import {
  contentPublicItemTag,
  contentPublicListTag,
  contentPublicSlugTag,
} from "../cache";

export interface ContentPublicFetchResult<TData> {
  data?: TData;
  status: number;
}

/**
 * Reads the generated public API from a server component, cached and tagged.
 *
 * Two things happen here that a bare `fetch` would not do:
 *
 * 1. **`cache: "force-cache"`.** Caching in Next 16 is opt-in - the default
 *    (`auto no cache`) refetches on every request as soon as the route touches
 *    a request-time API, and tags on an uncached response expire nothing
 *    because nothing was stored. Published content is the case that should be
 *    served from the cache until a mutation says otherwise, so it says so.
 * 2. **The tags.** The same strings {@link contentPublicListTag} and friends
 *    produce, so `revalidateContent` expires exactly these responses - and an
 *    app that tags its own fetches with them is invalidated at the same moment.
 *
 * A detail fetch is deliberately **not** tagged with the list tag. Publishing
 * one article must not throw away every article page.
 *
 * Only `200` responses are stored, so a 404 for a draft is never cached and
 * publishing it is visible immediately.
 *
 * ## Localized content types
 *
 * Pass `locale`. It does two things that have to happen together, which is why it
 * is one argument rather than a query parameter you add yourself:
 *
 * 1. It goes to the API as `?locale=`, so the response is the one for that
 *    language - explicitly, rather than through whatever `Accept-Language` the
 *    server-side `fetch` happens to send (which is none).
 * 2. It goes into the cache tags, so publishing a Polish translation expires the
 *    Polish pages and leaves the English ones warm. Sharing one tag across
 *    languages would make every publish a site-wide invalidation *and* let one
 *    language's cached response be served under another's tag.
 *
 * Omitting it on a localized content type is not an error - the API falls back to
 * the content type's default locale - but the response is then tagged as though it
 * were locale-less, so a translation publish will not expire it. Pass it.
 */
export const contentPublicFetch = async <TSchema extends z.ZodType>({
  definition,
  locale,
  pluginId,
  query,
  schema,
  slug,
}: {
  definition: PublicContentTypeDefinition;
  /** The language to read, for a localized content type. */
  locale?: string;
  pluginId: string;
  query?: Record<string, string | string[] | undefined>;
  schema?: TSchema;
  /** Omit for the list; pass one for the detail route. */
  slug?: string;
}): Promise<ContentPublicFetchResult<z.infer<TSchema>>> => {
  const contentTypeId = definition.id;
  const tags =
    slug === undefined
      ? [contentPublicListTag(contentTypeId, locale)]
      : [contentPublicSlugTag(contentTypeId, slug, locale)];

  const response = await rawApiFetch({
    method: "get",
    module: `content/${definition.publicApi.path}`,
    options: {
      // Opt in explicitly. Relying on the implicit default would make the tags
      // below decorative on any route that reads cookies or headers.
      cache: "force-cache",
      // Next augments the global `RequestInit` with `next`, which is why this
      // passes straight through the shared fetcher's `options`.
      next: { tags },
    },
    // A generated slug is URL-safe, but this is public API and the argument may
    // come from anywhere. Only the segment is encoded - encoding the module
    // path would turn its separators into `%2F`.
    path: slug === undefined ? "/" : `/${encodeURIComponent(slug)}`,
    pluginId,
    // Explicit, and last, so a caller cannot accidentally shadow it with a
    // `locale` of its own in `query` and read one language under another's tag.
    query: locale === undefined ? query : { ...query, locale },
  });

  if (!response.ok) return { status: response.status };

  const payload: unknown = await response.json();
  if (!schema) {
    return { data: payload as z.infer<TSchema>, status: response.status };
  }

  const parsed = schema.safeParse(payload);

  return parsed.success
    ? { data: parsed.data, status: response.status }
    : { status: response.status };
};

/**
 * Reads a record through a preview link, from a server component.
 *
 * The mirror image of {@link contentPublicFetch}, and deliberately so: this one
 * opts *out* of the cache and carries no tags at all.
 *
 * - **`cache: "no-store"`.** A preview is an unpublished record behind a
 *   short-lived credential. Storing one would keep a draft readable after the
 *   token expired, and would serve one reviewer's link to the next visitor.
 * - **No tags.** There is nothing to invalidate: the response was never stored,
 *   and a preview is a point-in-time read of one frozen revision.
 *
 * The route answers 404 for every kind of bad token, so a caller gets one
 * status to handle rather than a taxonomy - `notFound()` is the whole error
 * path.
 *
 * ```tsx title="src/app/articles/preview/[token]/page.tsx"
 * const { data } = await contentPreviewFetch({
 *   definition: articleContentType,
 *   pluginId: "@vitnode/example",
 *   token: (await params).token,
 * });
 * if (!data) notFound();
 * ```
 */
export const contentPreviewFetch = async <TSchema extends z.ZodType>({
  definition,
  locale,
  pluginId,
  schema,
  token,
}: {
  definition: PreviewableContentTypeDefinition;
  /**
   * The language the link previews, for a localized content type.
   *
   * It has to **match the token**, and the route refuses a mismatch in either
   * direction rather than falling back - a preview whose language could shift
   * under it is not a preview of anything. The mint route puts the right value in
   * the link as `?locale=`, so a page usually reads it straight off its own
   * `searchParams` and passes it through.
   */
  locale?: string;
  pluginId: string;
  schema?: TSchema;
  token: string;
}): Promise<ContentPublicFetchResult<z.infer<TSchema>>> => {
  const response = await rawApiFetch({
    method: "get",
    module: `content/${definition.publicApi.path}`,
    options: { cache: "no-store" },
    path: `/preview/${encodeURIComponent(token)}`,
    pluginId,
    query: locale === undefined ? undefined : { locale },
  });

  if (!response.ok) return { status: response.status };

  const payload: unknown = await response.json();
  if (!schema) {
    return { data: payload as z.infer<TSchema>, status: response.status };
  }

  const parsed = schema.safeParse(payload);

  return parsed.success
    ? { data: parsed.data, status: response.status }
    : { status: response.status };
};

/**
 * The tag a detail response keyed by identifier should carry.
 *
 * `locale` for a localized content type, for the same reason
 * {@link contentPublicFetch} takes one: the record has a page per language, and a
 * tag that named only the record would make one language's publish expire them
 * all.
 */
export const contentPublicItemTags = (
  definition: AnyContentTypeDefinition,
  id: number,
  locale?: string,
): string[] => [contentPublicItemTag(definition.id, id, locale)];
