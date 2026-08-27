import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import { handleLocaleRequest } from '#/server/locale.server'

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
 */
const localeMiddleware = createMiddleware().server(
  async ({ handlerType, next, request }) => {
    if (handlerType !== 'router') return await next()

    const { redirect, setCookie } = handleLocaleRequest(request)
    if (redirect) return redirect

    const result = await next()

    // `append`, not `set`: the API mounted at `/api/*` and the auth flow both
    // mint their own cookies, and overwriting the header would sign people out.
    if (setCookie) result.response.headers.append('set-cookie', setCookie)

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
