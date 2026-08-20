import type {
  RequestAdapter,
  RequestCookieStore,
  RequestHeaders,
} from "./types";

/**
 * Which adapter answers per-request reads, and the helpers core code calls.
 *
 * Two slots rather than one, so installation is order-independent. A host
 * framework's adapter fills the *default* slot as a side effect of the barrel
 * being imported ({@link setDefaultRequestAdapter}); an application that wants a
 * different one calls {@link setRequestAdapter}, which always wins no matter
 * which module happened to evaluate first.
 *
 * This module imports nothing but its own types, so a request adapter can be
 * written - and this registry loaded - without pulling Next into the graph.
 */
let installed: RequestAdapter | undefined;
let fallback: RequestAdapter | undefined;

/** Install the request adapter for this application. Overrides any default. */
export const setRequestAdapter = (adapter: RequestAdapter): void => {
  installed = adapter;
};

/**
 * Offer an adapter as the default, used only when nothing was installed
 * explicitly. Called by the barrel on import.
 */
export const setDefaultRequestAdapter = (adapter: RequestAdapter): void => {
  fallback = adapter;
};

/** Whether any adapter - installed or default - can answer a request read. */
export const hasRequestAdapter = (): boolean =>
  installed !== undefined || fallback !== undefined;

/**
 * The adapter to call, or a thrown error naming the fix.
 *
 * It throws rather than answering with an empty request, and that is the whole
 * decision in this file. Silently returning no cookies would make every
 * server-rendered API call anonymous: the pages still render, the session is
 * simply gone, and what looks like a logout bug is a wiring mistake three layers
 * away. Refusing to guess is what keeps that out of production.
 */
export const getRequestAdapter = (): RequestAdapter => {
  const adapter = installed ?? fallback;
  if (!adapter) {
    throw new Error(
      "No VitNode request adapter is installed. Import `@vitnode/core/framework/request` (which installs the Next.js adapter) before reading request state, or call `setRequestAdapter()` with your own adapter.",
    );
  }

  return adapter;
};

/** For tests: drop both slots so the next read starts from nothing. */
export const resetRequestAdapter = (): void => {
  installed = undefined;
  fallback = undefined;
};

/**
 * The incoming request's headers.
 *
 * Resolved through the registry on every call rather than captured at import.
 * Core code imports this helper at module load, so a captured adapter would
 * freeze whichever one happened to be installed first - the one order an
 * application cannot control.
 */
export const requestHeaders = async (): Promise<RequestHeaders> =>
  await getRequestAdapter().getHeaders();

/** The request's cookie jar, which also writes cookies onto the response. */
export const requestCookies = async (): Promise<RequestCookieStore> =>
  await getRequestAdapter().getCookies();

/**
 * Waits for a real request before continuing - see
 * {@link RequestAdapter.awaitRequest}.
 */
export const awaitRequest = async (): Promise<void> => {
  await getRequestAdapter().awaitRequest();
};

/**
 * The headers a server-side call to the VitNode API carries over from the
 * visitor's own request.
 *
 * Three of them, and each one is load-bearing:
 *
 * - `Cookie` is the session. Drop it and the API answers as an anonymous
 *   visitor, which is an authorisation change rather than a missing
 *   convenience.
 * - `user-agent` and `x-forwarded-for` are what the API records against a
 *   session and rate-limits on. Without them every request looks like it came
 *   from the app server, so one visitor's traffic is attributed to - and
 *   throttled alongside - everybody else's.
 *
 * The fallbacks exist because a header is absent far more often than it is
 * wrong: internal calls, some proxies, local dev. They are the historical values
 * and are kept verbatim.
 *
 * A fresh mutable object each call - `fetcher` adds the captcha token to it.
 */
export const forwardApiRequestHeaders = async (): Promise<
  Record<string, string>
> => {
  const [headers, cookies] = await Promise.all([
    requestHeaders(),
    requestCookies(),
  ]);

  return {
    Cookie: cookies.toString(),
    ["user-agent"]: headers.get("user-agent") ?? "node",
    ["x-forwarded-for"]: headers.get("x-forwarded-for") ?? "0.0.0.0",
  };
};
