import "server-only";
import type { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";

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
 * Reads the generated public API from a server component, tagged for you.
 *
 * The tags are the same strings {@link contentPublicListTag} and friends
 * produce, so `revalidateContent` expires exactly these responses - and an app
 * that tags its own fetches with them gets invalidated at the same moment.
 *
 * A detail fetch is deliberately **not** tagged with the list tag. Publishing
 * one article must not throw away every article page.
 */
export const contentPublicFetch = async <TSchema extends z.ZodType>({
  definition,
  pluginId,
  query,
  schema,
  slug,
}: {
  definition: AnyContentTypeDefinition;
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
    // Next augments the global `RequestInit` with `next`, which is why this
    // passes straight through the shared fetcher's `options`.
    options: { next: { tags } },
    path: slug === undefined ? "/" : `/${slug}`,
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
