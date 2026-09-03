import "@tanstack/react-start/server-only";
import {
  getRequestHeaders,
  getRequestIP,
  getRequestUrl,
  setCookie,
} from "@tanstack/react-start/server";
import { config } from "dotenv";

import type {
  BaseBuildModuleReturn,
  BuildModuleReturn,
} from "@/api/lib/module";
import type { Route } from "@/api/lib/route";
import type { RawApiFetchArgs } from "@/lib/fetcher/raw";
import type {
  FetcherParams,
  FetcherRequestOptions,
  GetModulePaths,
  GetValidMethodForPath,
  GetValidPathsForModule,
  InferResponseType,
} from "@/lib/fetcher/types";

import { CONFIG } from "@/lib/config";
import { coreFetcher } from "@/lib/fetcher/core";
import { rawApiFetch } from "@/lib/fetcher/raw";
import { buildForwardedHeaders } from "@/lib/fetcher/request-context";
import {
  parseSetCookies,
  shouldSaveApiCookies,
} from "@/lib/fetcher/set-cookie";

/**
 * `.env` into `process.env`, for anything that still reads it: the browser
 * bundle's inlined `NEXT_PUBLIC_*` values, the database and Redis URLs a mounted
 * API needs, and `resolveApiOrigin`'s fallback below.
 *
 * A host's Vite config already does this for `vite dev` and `vite build`. This
 * covers `node .output/server/index.mjs`, where Vite is not involved, the same
 * way `apps/api` does it - and it has to happen here rather than in the host,
 * because this is the first server module every request-scoped read goes
 * through. dotenv does not overwrite what is already set, so a platform that
 * injects real environment variables still wins.
 */
config({ quiet: true });

/**
 * The origin to call `/api/*` on.
 *
 * Two topologies, and the answer differs:
 *
 * - **The app serves its own API.** Nothing is configured, and the origin is
 *   whichever one the request being rendered arrived on. Taking it from the
 *   request is what makes a preview deployment work: its hostname is generated
 *   per branch, so no `NEXT_PUBLIC_API_URL` could name it, and a hard-coded
 *   default names a completely different app in development or nothing at all
 *   in production.
 * - **A separate API server.** `NEXT_PUBLIC_API_URL` names it, and it wins -
 *   the request origin is this app's own, where there is no `/api/*` to answer,
 *   so preferring it makes every server-side call a `404`. That is the shape
 *   `create-vitnode` scaffolds (`apps/web` on `:3000`, `apps/api` on `:8000`),
 *   and the browser already reads the same variable through `CONFIG.api`, so
 *   this is also what keeps the two halves of a render calling the same host.
 *
 * `getRequestUrl()` reads the `Host` header the request arrived with and honours
 * `x-forwarded-proto`, so a TLS-terminating proxy in front of a plain-HTTP
 * server still yields an `https:` origin. `x-forwarded-host` is deliberately
 * *not* honoured: it is a header a visitor can set, and these calls carry that
 * visitor's cookies, so trusting it would let a request point this server's API
 * calls at a host of the caller's choosing.
 *
 * Outside a request - boot, a script, a cron job - there is nothing to read and
 * `getRequestUrl()` throws, so `CONFIG.api` is the fallback there too.
 *
 * The browser reaches the same conclusion on its own: with nothing configured,
 * `CONFIG.api` reads the origin the document was served from, so a client-side
 * call stays on the same app. `NEXT_PUBLIC_API_URL` is therefore optional rather
 * than load-bearing - set it only to point at a separate API server.
 */
export const resolveApiOrigin = (): string => {
  // Through `CONFIG` rather than the variable directly, so the empty-value
  // throw stays in one place - see the `??` note there.
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) return CONFIG.api.origin;

  try {
    return getRequestUrl().origin;
  } catch {
    return CONFIG.api.origin;
  }
};

/**
 * The request state a Start app forwards to the API, read off the request being
 * rendered.
 *
 * The API derives who is asking from `Cookie`, the device record from
 * `user-agent`, and the rate-limit key and audit IP from `x-forwarded-for`. Send
 * none of it and every SSR render is answered as an anonymous visitor sharing a
 * single rate-limit bucket - so this is the difference between signed-in HTML and
 * signed-out HTML, not a nicety.
 *
 * The allowlist itself lives in `@/lib/fetcher/request-context`, framework-free,
 * because only the reading is this runtime's. Nothing else
 * is copied across: `host` and `content-length` describe the page request rather
 * than the API call, and `origin`, `referer` and `authorization` are values the
 * API trusts, so forwarding whatever a visitor put in them would hand them state
 * they should not control.
 */
export const getForwardedApiHeaders = ({
  captchaToken,
}: { captchaToken?: string } = {}): Record<string, string> => {
  const headers = getRequestHeaders();

  return buildForwardedHeaders({
    captchaToken,
    cookie: headers.get("cookie"),
    // The header first, verbatim, chain included: that is what the API stores,
    // and re-deriving it would log this server's hop as the visitor's IP. `getRequestIP()` is the fallback for a
    // directly-exposed server, where there is no proxy to have written one -
    // better than the `0.0.0.0` the header's absence would otherwise mean.
    forwardedFor: headers.get("x-forwarded-for") ?? getRequestIP(),
    userAgent: headers.get("user-agent"),
  });
};

/**
 * Copies the cookies the API just minted onto this response - what
 * `allowSaveCookies` below is built on.
 *
 * Sign-in, sign-up, sign-out and the SSO callback all answer with a
 * `Set-Cookie`, and so does any first call from a browser with no device cookie.
 * Those land on the API's response to *this server*, which the browser never
 * sees, so without this the visitor is signed in for exactly one render.
 *
 * Call it only for a response you meant to trust: it writes every cookie the
 * response carries.
 */
export const saveApiCookies = (response: Response): void => {
  for (const { name, options, value } of parseSetCookies(
    response.headers.getSetCookie(),
  )) {
    setCookie(name, value, options);
  }
};

/**
 * The same request context, for a module the type system cannot name.
 *
 * A Content Engine module is generated at runtime from a definition, so there is
 * no `typeof` for {@link fetcher} to infer route literals from - see
 * `views/admin/views/content/content-request.ts`. Those calls still need the
 * visitor's cookies and this request's origin, and this is that half of
 * `fetcher` without the typing, so the transport is decided in one place rather
 * than reassembled per caller.
 *
 * Prefer {@link fetcher}. Reach for this only when the module is generated.
 */
export const rawFetcher = async ({
  additionalHeaders,
  origin,
  ...args
}: RawApiFetchArgs): Promise<Response> =>
  await rawApiFetch({
    ...args,
    additionalHeaders: { ...getForwardedApiHeaders(), ...additionalHeaders },
    origin: origin ?? resolveApiOrigin(),
  });

/**
 * The server-side fetcher: one call, the API module it talks to, and the route
 * on it.
 *
 *     const response = await fetcher(usersModule, {
 *       method: "post",
 *       module: "users",
 *       path: "/sign_in",
 *       allowSaveCookies: true,
 *       args: { body: { email, password } },
 *     });
 *
 * The same signature the Next.js `fetcher()` had, so a route literal, its
 * method, its `args` and the response schema all infer from the module and
 * nothing about a call is spelled twice. `args` is required exactly when the
 * route declares a body, params or a query - see {@link FetcherParams}.
 *
 * What it adds to `coreFetcher` is this request:
 *
 * - the visitor's `Cookie`, `user-agent` and `x-forwarded-for`, so the API knows
 *   who is asking and buckets the rate limiter correctly,
 * - the origin the page request arrived on, so a preview deployment calls
 *   itself,
 * - `captchaToken` as the header `captchaMiddleware` reads, and
 * - `allowSaveCookies`, which copies a `2xx`'s `Set-Cookie` onto the response
 *   this server is building. Without it a freshly minted session lives for
 *   exactly one render.
 *
 * Server-side only, and only inside a request: the headers come from the request
 * currently being handled, so a module-scope call has nothing to read. In
 * TanStack Start that means a `createServerFn` handler, a server route, or the
 * `.server()` branch of a `createIsomorphicFn` - not a route `loader`, which
 * also runs in the browser on client-side navigation.
 */
export async function fetcher<
  M extends string,
  Routes extends Route[],
  Modules extends BaseBuildModuleReturn[],
  ModuleName extends GetModulePaths<M, Modules>,
  SelectedPath extends GetValidPathsForModule<ModuleName, M, Routes, Modules>,
  Method extends GetValidMethodForPath<
    ModuleName,
    SelectedPath,
    M,
    Routes,
    Modules
  > = GetValidMethodForPath<ModuleName, SelectedPath, M, Routes, Modules>,
>(
  moduleReturn: BuildModuleReturn<string, M, Routes, Modules>,
  {
    path,
    method,
    module,
    args,
    options,
    formData,
    additionalHeaders,
    allowSaveCookies = false,
    captchaToken,
    origin,
    prefixPath = "",
    withPagination = false,
  }: FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    FetcherRequestOptions & {
      allowSaveCookies?: boolean;
      captchaToken?: string;
    },
): Promise<
  InferResponseType<M, Routes, Modules, ModuleName, SelectedPath, Method>
> {
  const response = await coreFetcher(moduleReturn, {
    path,
    method,
    module,
    args,
    options,
    formData,
    prefixPath,
    withPagination,
    additionalHeaders: {
      ...getForwardedApiHeaders({ captchaToken }),
      ...additionalHeaders,
    },
    // `NEXT_PUBLIC_API_URL` when a separate API server is configured, this
    // request's own origin otherwise - and an explicit `origin` on the call
    // overrides both.
    origin: origin ?? resolveApiOrigin(),
  } as FetcherParams<M, Routes, Modules, ModuleName, SelectedPath, Method> &
    FetcherRequestOptions);

  if (allowSaveCookies && shouldSaveApiCookies((response as Response).status)) {
    saveApiCookies(response);
  }

  return response;
}
