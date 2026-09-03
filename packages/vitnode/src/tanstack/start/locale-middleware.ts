import type { RequestServerOptions } from "@tanstack/react-start";

import { createMiddleware } from "@tanstack/react-start";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { handleLocaleRequest } from "../i18n/request";
import {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
} from "./document-headers";

/**
 * No `server-only` marker here, and that is load-bearing rather than an
 * oversight.
 *
 * `src/start.ts` is in the *client* bundle too - `hydrateStart` imports
 * `startInstance` from it - so a top-level `import "@tanstack/react-start/server-only"`
 * in this chain is an import-protection error in the client build, not a
 * safeguard. What actually keeps the server half out of the browser is the Start
 * compiler: it strips a middleware's `.server()` callback from the client
 * bundle, which kills the only live reference to `handleLocaleRequest` and lets
 * `../i18n/request` - which *is* marked server-only - shake out with it.
 *
 * So the rule is: everything a browser must not hold stays reachable only from
 * inside the `.server()` callback below.
 */

/** As much of a request middleware's context as the locale rule reads. */
type LocaleRequestContext = Pick<
  RequestServerOptions<unknown, unknown>,
  "handlerType" | "next" | "request"
>;

/**
 * Locale routing and document cache policy, as one pass over a request.
 *
 * Exported as a plain function so the rule is testable without a Start runtime:
 * {@link createLocaleRequestMiddleware} is the three lines that hand it to
 * Start.
 *
 * `handlerType` narrows it to page requests. Server function calls arrive on
 * `/_serverFn/*` with `handlerType: "serverFn"`, and redirecting an RPC to a
 * canonical URL breaks it rather than tidying it.
 *
 * `/api/*` reaches here too and is deliberately ignored by `handleLocaleRequest`
 * - and, being JSON rather than HTML, by the cache rule as well - so the Hono
 * bridge sees the request exactly as the client sent it and keeps whatever
 * caching it decided on.
 */
export const runLocaleRequest = async (
  { handlerType, next, request }: LocaleRequestContext,
  localeRouting: LocaleRouting,
) => {
  if (handlerType !== "router") return await next();

  const { redirect, setCookie } = handleLocaleRequest(request, localeRouting);
  if (redirect) {
    applyRedirectCacheControl(redirect);

    return redirect;
  }

  const result = await next();

  // `append`, not `set`: the API mounted at `/api/*` and the auth flow both mint
  // their own cookies, and overwriting the header would sign people out.
  if (setCookie) result.response.headers.append("set-cookie", setCookie);

  // After the cookie, so a document that just wrote one is covered by the same
  // directive as one that did not.
  applyDocumentCacheControl(result.response);

  return result;
};

/**
 * The locale half of VitNode's request pipeline, bound to one app's languages.
 *
 * `localeRouting` is passed in rather than read from the registered i18n runtime
 * because Start runs request middleware before route matching - so this is the
 * one caller that cannot assume the router entry has been evaluated. An explicit
 * argument makes the ordering a fact of the call rather than a hope about module
 * evaluation.
 */
export const createLocaleRequestMiddleware = (localeRouting: LocaleRouting) =>
  createMiddleware().server(
    async ctx => await runLocaleRequest(ctx, localeRouting),
  );
