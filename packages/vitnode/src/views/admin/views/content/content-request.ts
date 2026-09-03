import type { z } from "zod";

import type { UniversalRawFetcher } from "@/lib/fetcher-client";
import type { RawApiFetchArgs } from "@/lib/fetcher/raw";

import { rawFetcherClient } from "@/lib/fetcher-client";
import { AdminRequestError } from "@/views/admin/admin-request";

/** Which generated module a request is for. */
export interface ContentApiTarget {
  /** `definition.permissionModule` - the module name under `content/`. */
  permissionModule: string;
  /** The plugin that registered the content type. */
  pluginId: string;
}

export interface ContentApiRequest {
  body?: unknown;
  method: "delete" | "get" | "post" | "put";
  /** Route path within the content module - `/`, `/{id}`, `/{id}/revisions`. */
  path?: string;
  query?: Record<string, string | string[] | undefined>;
  target: ContentApiTarget;
}

export const contentApiFetchArgs = ({
  body,
  method,
  path = "/",
  query,
  target,
}: ContentApiRequest): RawApiFetchArgs => ({
  body,
  method,
  module: `content/${target.permissionModule}`,
  path,
  pluginId: target.pluginId,
  prefixPath: "/admin",
  query,
});

/**
 * One request to a generated content module, over whichever transport it is
 * handed. See {@link ContentApiFetch}.
 *
 * No headers of its own - the session cookie is the browser's to attach and the
 * server transport's to forward, and the API derives who is asking from it.
 */
export const contentApiFetcher =
  (transport: UniversalRawFetcher): ContentApiFetch =>
  async (request, { signal } = {}) =>
    await transport({ ...contentApiFetchArgs(request), options: { signal } });

/**
 * How one content request is carried.
 *
 * `signal` is the read's cancellation, when it has one. It reaches `fetch`
 * untouched, and an abort therefore rejects at the transport rather than
 * anywhere downstream: there is no response for `readContentApiJson` to inspect
 * and no `catch` in the way, so a cancelled read cannot be mistaken for a
 * refusal or for an empty list. Writes never pass one - a cancelled write leaves
 * the server's state unknown and the cache un-invalidated.
 */
export type ContentApiFetch = (
  request: ContentApiRequest,
  options?: { signal?: AbortSignal },
) => Promise<Response>;

/** The browser half of the transport. */
export const contentApiFetchInBrowser: ContentApiFetch =
  contentApiFetcher(rawFetcherClient);

/** A request paired with what it was for, so a failure can say. */
export interface ContentApiRead<TSchema extends z.ZodType> {
  /** What this read was, in words, for an error message somebody has to act on. */
  describe: string;
  schema: TSchema;
}

/**
 * The response, parsed - or a thrown {@link AdminRequestError}.
 *
 * Throwing rather than returning a result object, and that is the difference
 * between this and `contentApiFetch`. The Next.js server actions return
 * `{ data?, error?, status }` because a Server Component decides what to render
 * from it; a TanStack Query function has to **reject**, or the failure is cached
 * as a value and the table renders empty - which looks exactly like a content
 * type with no records in it, the one thing a list must never look like.
 *
 * A schema mismatch throws too, with the same class. It means the installed
 * plugin and the running API disagree about a content type's shape, which is a
 * deployment fault rather than a bad request, and rendering half a row would
 * hide it.
 */
export const readContentApiJson = async <TSchema extends z.ZodType>(
  response: Response,
  { describe, schema }: ContentApiRead<TSchema>,
): Promise<z.infer<TSchema>> => {
  if (!response.ok) {
    throw new AdminRequestError(
      response.status,
      describe,
      await response.text(),
    );
  }

  const parsed = schema.safeParse(await response.json());

  if (!parsed.success) {
    throw new AdminRequestError(
      response.status,
      describe,
      "the API returned a response this content type does not describe",
    );
  }

  return parsed.data;
};
