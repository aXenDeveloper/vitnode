import { createIsomorphicFn } from "@tanstack/react-start";

import type {
  FetcherClientOptions,
  UniversalFetcher,
  UniversalRawFetcher,
} from "@/lib/fetcher-client";

import { fetcherClient, rawFetcherClient } from "@/lib/fetcher-client";

import {
  fetcher as serverFetcher,
  rawFetcher as serverRawFetcher,
} from "./server";

export type { FetcherClientOptions, UniversalFetcher, UniversalRawFetcher };
export type { ApiEndpoint, ApiPluginContract } from "@/lib/fetcher/contract";
export type { ApiPluginRegistry } from "@/lib/fetcher/registry";
export type {
  AllEndpoints,
  ApiRequest,
  PluginEndpoints,
  PluginModulePath,
  PluginRouteMethod,
  PluginRoutePath,
  RegisteredPluginId,
  ResponseFor,
} from "@/lib/fetcher/types";

type IsomorphicFetcher = (request: never) => Promise<Response>;

/**
 * Calls a VitNode API route with types inferred from the plugin API registry.
 * Universal: the same call runs during SSR and in the browser, so use it in
 * route loaders, query functions and shared `views/*` modules.
 *
 * `plugin`, `module` (any nesting depth, e.g. `admin/advanced/cron`), `path`
 * and `method` must name a registered route - a wrong one is a compile error
 * at that property. `args` (`body`, `params`, `query`) is typed by the route's
 * Zod schemas and required exactly when the route declares one of them. The
 * response's `json()` and `status` are typed per declared response; a JSON
 * body is typed as it arrives, so a `z.date()` field is its ISO `string`.
 *
 * On the server it forwards the visitor's cookie, user agent and IP to the API
 * at `VITNODE_API_URL` (or this request's origin). In the browser it sends
 * credentials and reports a `429` as a `vitnode:rate-limit` window event. For
 * server-only options - `allowSaveCookies`, `additionalHeaders`, `origin` - use
 * the fetcher from `@vitnode/core/tanstack/fetcher/server`.
 *
 * Resolves with the `Response` for every status except `500` - check `res.ok`
 * or `res.status` before reading the body; any other `4xx` or `5xx` is also
 * logged to the console. Rejects on a `500` (with the response body in the
 * message) and on network failure.
 *
 * @example
 * ```ts
 * import { fetcher } from "@vitnode/core/tanstack/fetcher";
 *
 * const res = await fetcher({
 *   plugin: "@vitnode/core",
 *   method: "get",
 *   module: "users",
 *   path: "/devices",
 * });
 * if (!res.ok) throw new Error("Could not load devices");
 * const devices = await res.json();
 * ```
 */
export const fetcher = createIsomorphicFn()
  .server(serverFetcher as IsomorphicFetcher)
  .client(fetcherClient) as UniversalFetcher;

/**
 * An untyped, universal API call, for the Content Engine's generated admin
 * modules, which have no route types to infer from. Everything else - including
 * a content type's public routes (`module: "content/<publicApi.path>"`) - uses
 * the typed {@link fetcher}.
 *
 * Same transport and status handling as {@link fetcher}, except that a browser
 * `429` dispatches no `vitnode:rate-limit` event. `pluginId`, `module`, `path`,
 * `params`, `query` and `body` are passed as they are.
 */
export const rawFetcher = createIsomorphicFn()
  .server(serverRawFetcher)
  .client(rawFetcherClient) as UniversalRawFetcher;
