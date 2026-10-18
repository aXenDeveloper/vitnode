import "@tanstack/react-start/server-only";
import {
  getRequest,
  getRequestHeaders,
  getRequestIP,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";
import { config } from "dotenv";

import type { ApiTransport, RawApiFetchArgs } from "@/lib/fetcher/raw";
import type {
  FetcherCall,
  FetcherRequestOptions,
  RegisteredPluginId,
  ResponseFor,
} from "@/lib/fetcher/types";

import { executionContextOf } from "@/api/lib/after-response";
import { CONFIG } from "@/lib/config";
import { coreFetcher } from "@/lib/fetcher/core";
import {
  FORWARDED_SIGNATURE_HEADER,
  resolveForwardedIpSecret,
  signForwardedFor,
} from "@/lib/fetcher/forwarded-signature.server";
import { getInProcessApi } from "@/lib/fetcher/in-process-api.server";
import { rawApiFetch } from "@/lib/fetcher/raw";
import {
  buildForwardedHeaders,
  resolveVisitorIp,
} from "@/lib/fetcher/request-context";
import {
  parseSetCookies,
  shouldSaveApiCookies,
} from "@/lib/fetcher/set-cookie";
import { recordPageCacheApiResponse } from "@/page-cache/render-context.server";

config({ quiet: true });

/**
 * The origin server-side API calls go to: `VITNODE_API_URL` when set (a
 * separate API server), otherwise the origin of the request being handled.
 */
export const resolveApiOrigin = (): string => {
  // Through `CONFIG` rather than the variable directly, so the empty-value
  // throw stays in one place - see the `??` note there.
  if (process.env.VITNODE_API_URL !== undefined) return CONFIG.api.origin;

  try {
    return getRequestUrl().origin;
  } catch {
    return CONFIG.api.origin;
  }
};

// This app serves its own API at its web origin, so a `VITNODE_API_URL` naming
// that same origin is not a separate server either.
const isApiOnThisOrigin = (): boolean => {
  const configured = process.env.VITNODE_API_URL;
  if (configured === undefined) return true;

  try {
    return new URL(configured).origin === CONFIG.web.origin;
  } catch {
    return false;
  }
};

const fromRequest = <T>(read: () => T): T | undefined => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

/**
 * When the API is mounted in this process, the request is handed to it
 * directly: no socket, no DNS or proxy hop, no second pass through the app's
 * request pipeline and page cache. The headers are the ones a network call
 * would carry - signature included - so the API trusts exactly what it did.
 * An explicit `origin` always goes over the network.
 */
const inProcessTransport = (
  origin: string | undefined,
): ApiTransport | undefined => {
  if (origin !== undefined || !isApiOnThisOrigin()) return undefined;

  const handler = getInProcessApi();
  if (!handler) return undefined;

  // The socket address the `/api/*` route hands the API for a browser call,
  // so its client-IP fallback resolves the same visitor.
  const clientAddress = fromRequest(getRequestIP);
  // Work the API starts after its response (queued emails) lives as long as
  // the page request does.
  const incoming = fromRequest(getRequest);
  const executionCtx = incoming ? executionContextOf(incoming) : undefined;

  return async request =>
    await handler(request, { clientAddress }, executionCtx);
};

type FetchOptions = RawApiFetchArgs["options"];

// The visitor leaving aborts the API calls their render was waiting on. A
// shared page-cache render runs on a request of its own, so one visitor's
// disconnect never cancels a page others are waiting for.
const withRequestSignal = (options: FetchOptions): FetchOptions => {
  const incoming = fromRequest(() => getRequest().signal);
  if (!incoming) return options;

  const own = options?.signal;

  return {
    ...options,
    signal: own ? AbortSignal.any([own, incoming]) : incoming,
  };
};

/**
 * The headers that make a server-side API call act for the current visitor:
 * their cookie, user agent and IP (`x-forwarded-for`, signed when a forwarding
 * secret is configured), plus the captcha token when given.
 */
export const getForwardedApiHeaders = ({
  captchaToken,
}: { captchaToken?: string } = {}): Record<string, string> => {
  const headers = getRequestHeaders();
  const forwarded = buildForwardedHeaders({
    captchaToken,
    cookie: headers.get("cookie"),
    forwardedFor: resolveVisitorIp({
      forwardedFor: headers.get("x-forwarded-for"),
      socketAddress: getRequestIP(),
      trustedProxyHops: CONFIG.trustedProxyHops,
    }),
    userAgent: headers.get("user-agent"),
  });
  const secret = resolveForwardedIpSecret();
  if (!secret) return forwarded;

  return {
    ...forwarded,
    [FORWARDED_SIGNATURE_HEADER]: signForwardedFor({
      forwardedFor: forwarded["x-forwarded-for"],
      secret,
    }),
  };
};

/** Copies an API response's `Set-Cookie` headers onto the current SSR response. */
export const saveApiCookies = (response: Response): void => {
  for (const { name, options, value } of parseSetCookies(
    response.headers.getSetCookie(),
  )) {
    setCookie(name, value, options);
  }
};

/**
 * The server-only {@link fetcher} for untyped calls - generated Content Engine
 * admin modules. Forwards the visitor's headers like the typed one.
 */
export const rawFetcher = async ({
  additionalHeaders,
  options,
  origin,
  ...args
}: RawApiFetchArgs): Promise<Response> => {
  const response = await rawApiFetch(
    {
      ...args,
      additionalHeaders: { ...getForwardedApiHeaders(), ...additionalHeaders },
      options: withRequestSignal(options),
      origin: origin ?? resolveApiOrigin(),
    },
    inProcessTransport(origin),
  );
  recordPageCacheApiResponse(response);

  return response;
};

/** What the server-only {@link fetcher} accepts besides the route and `args`. */
export type FetcherServerOptions = FetcherRequestOptions & {
  /**
   * Relays the API's `Set-Cookie` headers to the visitor's browser on a `2xx`
   * response - for sign-in, sign-out and other calls that change the session
   * from a server function. Defaults to `false`.
   */
  allowSaveCookies?: boolean;
  /** Sent as `x-vitnode-captcha-token`, for routes built with `withCaptcha`. */
  captchaToken?: string;
};

/**
 * The server-only twin of the universal `fetcher` from
 * `@vitnode/core/tanstack/fetcher`: same call shape and inference, plus
 * `allowSaveCookies`, `additionalHeaders` and `origin`.
 *
 * Use it only for work that is genuinely server-side: server functions, cookie
 * relay, cron and jobs, calls that carry upstream secrets or target another
 * origin. Importing it into a browser bundle fails the build.
 *
 * Resolves with the `Response` for every status except `500` and rejects on a
 * `500` or a network failure, like the universal fetcher.
 *
 * @example
 * ```ts
 * import { fetcher } from "@vitnode/core/tanstack/fetcher/server";
 *
 * const res = await fetcher({
 *   plugin: "@vitnode/core",
 *   method: "delete",
 *   module: "users",
 *   path: "/sign_out",
 *   args: { body: {} },
 *   allowSaveCookies: true,
 * });
 * ```
 */
export async function fetcher<
  P extends RegisteredPluginId,
  M extends string,
  Path extends string,
  Method extends string,
>({
  additionalHeaders,
  allowSaveCookies = false,
  args,
  captchaToken,
  formData,
  method,
  module,
  options,
  origin,
  path,
  plugin,
  withPagination = false,
}: FetcherCall<P, M, Path, Method, FetcherServerOptions>): Promise<
  ResponseFor<P, M, Path, Method>
> {
  const response = await coreFetcher<P, M, Path, Method>(
    {
      args,
      formData,
      method,
      module,
      options: withRequestSignal(options),
      path,
      plugin,
      withPagination,
      additionalHeaders: {
        ...getForwardedApiHeaders({ captchaToken }),
        ...additionalHeaders,
      },
      // `VITNODE_API_URL` when a separate API server is configured, this
      // request's own origin otherwise - and an explicit `origin` on the call
      // overrides both.
      origin: origin ?? resolveApiOrigin(),
    } as FetcherCall<P, M, Path, Method, FetcherRequestOptions>,
    inProcessTransport(origin),
  );

  // Inside a shared render, the page is stored with the data it read - so a
  // change to that data can invalidate it, and private data keeps it uncached.
  recordPageCacheApiResponse(response);

  if (allowSaveCookies && shouldSaveApiCookies((response as Response).status)) {
    saveApiCookies(response);
  }

  return response;
}
