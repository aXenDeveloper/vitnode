import "server-only";
import type { z } from "zod";

import type {
  AnyContentTypeDefinition,
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
 */
export const contentPublicFetch = async <TSchema extends z.ZodType>({
  definition,
  pluginId,
  query,
  schema,
  slug,
}: {
  definition: PublicContentTypeDefinition;
  pluginId: string;
  query?: Record<string, string | string[] | undefined>;
  schema?: TSchema;
  /** Omit for the list; pass one for the detail route. */
  slug?: string;
}): Promise<ContentPublicFetchResult<z.infer<TSchema>>> => {
  const contentTypeId = definition.id;
  const tags =
    slug === undefined
      ? [contentPublicListTag(contentTypeId)]
      : [contentPublicSlugTag(contentTypeId, slug)];

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
    query,
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

/** The tag a detail response keyed by identifier should carry. */
export const contentPublicItemTags = (
  definition: AnyContentTypeDefinition,
  id: number,
): string[] => [contentPublicItemTag(definition.id, id)];
