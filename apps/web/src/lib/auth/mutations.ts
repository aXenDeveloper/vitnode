import { createServerFn } from '@tanstack/react-start'

import {
  signInInputSchema,
  signOutInputSchema,
  ssoCallbackInputSchema,
  ssoStartInputSchema,
} from '#/lib/auth/contract'
import {
  completeSsoOnApi,
  signInOnApi,
  signOutOnApi,
  startSsoOnApi,
} from '#/server/auth.server'

/**
 * The auth mutations, as this app's only way to change who is signed in.
 *
 *     browser -> server function -> fetcherServer -> Hono users API
 *                                                        |
 *                     browser <- saveApiCookies <- Set-Cookie
 *
 * `createServerFn`, not the `createIsomorphicFn` the public reads use, and the
 * difference is not stylistic. A session is a `Set-Cookie` on the API's reply to
 * *this server*, so something on this server has to copy it onto the response the
 * browser is actually reading - which is what `saveApiCookies` does, and what a
 * browser-side fetch could never arrange. The visitor's current cookies have to
 * travel the other way for the same reason: sign-out identifies the session to
 * end by the cookie the request arrives with.
 *
 * Every one of them is a `POST`, which is what puts them behind the
 * `createCsrfMiddleware` in `src/start.ts`: without it these would be
 * unauthenticated endpoints that sign people in and out of this app from another
 * origin's page.
 *
 * Each has an explicit validator, because the input is a browser's and the
 * values reach an API path (`providerId`) and a credential check (`email`,
 * `password`). Untrusted until parsed - see `#/lib/auth/contract`, which holds
 * the schemas and the finite results, and is pure so both can be tested without
 * a server.
 *
 * None of them redirects, and none of them touches cached state. They answer
 * with a small closed result; the caller navigates - `#/lib/auth/return-to`
 * decides where a post-login target is allowed to point - and the caller
 * invalidates the session it holds.
 *
 * The bodies live in `#/server/auth.server`, which is what keeps the request
 * scope and its `server-only` marker out of the browser bundle: they are
 * referenced only inside these handlers, and Start's compiler removes a handler
 * body - and the imports left unused with it - from the client build.
 */

/**
 * Signs a visitor in.
 *
 * `{ ok: true }` means the session cookie is on the response this call is
 * answering with, so the very next request from this browser is signed in.
 * `access_denied` is a wrong address or password; every other outcome is
 * `server_error`.
 */
export const signIn = createServerFn({ method: 'POST' })
  .validator(signInInputSchema)
  .handler(async ({ data }) => await signInOnApi(data))

/**
 * Ends the current session. The reply carries the cookie deletion, so the
 * caller's next request is anonymous - it still has to invalidate whatever it
 * cached about the visitor.
 */
export const signOut = createServerFn({ method: 'POST' })
  .validator(signOutInputSchema)
  .handler(async ({ data }) => await signOutOnApi(data))

/**
 * Begins an SSO sign-in and returns the provider's authorization URL.
 *
 * The URL is returned rather than redirected to. The provider is another origin,
 * so leaving here is a full-document navigation the caller performs
 * (`window.location.assign(url)`); a router redirect cannot express that. The
 * URL is checked to be `http(s)` before it is handed over, since the caller puts
 * a browser at it.
 */
export const startSso = createServerFn({ method: 'POST' })
  .validator(ssoStartInputSchema)
  .handler(async ({ data }) => await startSsoOnApi(data))

/**
 * Completes an SSO sign-in, exchanging the provider's `code` for a session.
 *
 * Give it `parseSsoCallback(...)`'s `params`: a callback that came back with
 * `error=` instead of a `code` never needs to reach the API, and reading the
 * query belongs to the route that has it. `state` is passed through untouched
 * for the API to verify against the cookie it minted - this app neither
 * generates nor re-checks it.
 */
export const completeSso = createServerFn({ method: 'POST' })
  .validator(ssoCallbackInputSchema)
  .handler(async ({ data }) => await completeSsoOnApi(data))
