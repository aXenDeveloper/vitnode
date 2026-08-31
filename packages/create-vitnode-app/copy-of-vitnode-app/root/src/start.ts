import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { handleLocaleRequest } from '@vitnode/core/tanstack/i18n/server'

import {
  applyDocumentCacheControl,
  applyRedirectCacheControl,
} from '#/lib/document-headers'
import { localeRouting } from '#/lib/i18n/runtime'

/**
 * Locale routing, as the first thing that happens to a request.
 *
 * A global request middleware rather than a wrapper around the server entry:
 * Start runs these before route matching and before SSR, which is exactly where
 * a canonical redirect belongs - the alternative is rendering a page and then
 * throwing it away.
 *
 * `handlerType` narrows it to page requests. Server function calls arrive on
 * `/_serverFn/*` with `handlerType: "serverFn"`, and redirecting an RPC to a
 * canonical URL would break it rather than tidy it.
 *
 * `/api/*` reaches here too and is deliberately ignored by
 * `handleLocaleRequest`, so the Stage 1 Hono bridge sees the request exactly as
 * the client sent it.
 *
 * `localeRouting` is handed in rather than read from the package's registered
 * runtime: Start runs request middleware before route matching, so this is the
 * one caller that cannot assume the router entry has been evaluated. Importing
 * it from `#/lib/i18n/runtime` is also what guarantees this app's i18n is
 * configured before the first request touches it.
 *
 * ## And what a document is allowed to say about itself
 *
 * The cache directive rides along here for one reason: this is already the only
 * place in the application that holds every page response, before and after
 * rendering, and a second middleware would be a second thing to remember. Every
 * document this app produces carries a dehydrated Query cache containing the
 * visitor's own session - and, under `/admin`, an administrator's whole
 * permission set - so none of them may be stored by a shared cache. See
 * `#/lib/document-headers`, which owns the rule and says why; this file only
 * applies it.
 */
const localeMiddleware = createMiddleware().server(
  async ({ handlerType, next, request }) => {
    if (handlerType !== 'router') return await next()

    const { redirect, setCookie } = handleLocaleRequest(request, localeRouting)
    if (redirect) {
      applyRedirectCacheControl(redirect)

      return redirect
    }

    const result = await next()

    // `append`, not `set`: the API mounted at `/api/*` and the auth flow both
    // mint their own cookies, and overwriting the header would sign people out.
    if (setCookie) result.response.headers.append('set-cookie', setCookie)

    // After the cookie, so a document that just wrote one is covered by the
    // same directive as one that did not. Only an HTML response is touched -
    // `/api/*` reaches here too, and the API's own caching is not this
    // middleware's to decide.
    applyDocumentCacheControl(result.response)

    return result
  },
)

/**
 * This app's Start instance.
 *
 * `createCsrfMiddleware` is not optional here. Start installs it *only* while an
 * app declares no `requestMiddleware` of its own - the moment this file exists,
 * the default is replaced by whatever it lists, and leaving CSRF out would
 * expose every server function as an unauthenticated cross-site endpoint. It is
 * declared first so it runs before anything else.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' }),
    localeMiddleware,
  ],
}))
