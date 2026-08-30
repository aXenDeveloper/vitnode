import type { z } from "zod";

import type { RawApiFetchArgs } from "@/lib/fetcher/raw";

import { rawApiFetch } from "@/lib/fetcher/raw";
import { AdminRequestError } from "@/views/admin/admin-request";

/**
 * How the AdminCP addresses a generated Content Engine route, and what it does
 * with the answer.
 *
 * The framework-neutral half of the Content Engine's transport: it builds the
 * request and reads the response, and says nothing about *where* the call runs.
 * A TanStack host wraps it in `createIsomorphicFn`; the Next.js AdminCP has its
 * own `content/admin/fetch.server.ts`, which does the same URL arithmetic
 * against `next/headers`.
 *
 * ## Why the typed fetcher cannot be used here
 *
 * Every other AdminCP screen calls `fetcherClient(adminModuleRef<typeof
 * someModule>(), …)`, and the route literals, methods and response schemas all
 * infer from that module's *type*. A content module has no type to name: it is
 * generated at runtime from a definition, one per installed content type, so
 * there is nothing for `typeof` to point at.
 *
 * The response is not untyped as a result - it is typed by the content type's
 * own Zod schema instead, which is stricter than a route literal and is the same
 * arrangement `contentApiFetch` already uses on the Next.js side.
 */

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

/**
 * The request, as the shared fetcher's arguments.
 *
 * `/api/{pluginId}/admin/content/{permissionModule}{path}` - exactly what
 * `buildContentAdminModule` mounts, spelled in one place so a change to the
 * mount point is a change to one function.
 *
 * `withPagination` is deliberately never set. It writes `first=10` and
 * `search=""` *inside* the URL builder, invisibly to anything upstream including
 * a cache key - so two requests that differ only in that hidden default would
 * share one entry. Every page size these routes send is explicit.
 */
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
 * The browser half of the transport.
 *
 * No headers of its own - the admin cookie is the browser's to attach, and the
 * API derives who is asking from it. The server half lives in
 * `tanstack/admin/content/server.ts`, where the request scope it needs actually
 * exists.
 *
 * `credentials: "include"` because the API's origin is `NEXT_PUBLIC_API_URL`,
 * which an installation is free to point at a separate host - and a
 * cross-origin `fetch` sends no cookie at all without it. It is a no-op when the
 * two are the same origin, which is the default (`CONFIG.api` falls through to
 * `location.origin`), so this is right in both deployments rather than in one.
 * Every other AdminCP write in this package does the same, and the API's CORS is
 * configured `credentials: true` for exactly this.
 */
export const contentApiFetchInBrowser = async (
  request: ContentApiRequest,
  /**
   * The read's cancellation, when it has one.
   *
   * Reaches `fetch` untouched, and an abort therefore rejects here rather than
   * anywhere downstream: there is no response for `readContentApiJson` to
   * inspect and no `catch` in the way, so a cancelled read cannot be mistaken
   * for a refusal or for an empty list. Writes never pass one - a cancelled
   * write leaves the server's state unknown and the cache un-invalidated.
   */
  { signal }: { signal?: AbortSignal } = {},
): Promise<Response> =>
  await rawApiFetch({
    ...contentApiFetchArgs(request),
    options: { credentials: "include", signal },
  });

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
