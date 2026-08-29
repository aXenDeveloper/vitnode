import { createServerFn } from '@tanstack/react-start'
import {
  changePasswordInputSchema,
  passwordResetRequestInputSchema,
  setAuthTransport,
  signInInputSchema,
  signOutInputSchema,
  signUpInputSchema,
  ssoCallbackInputSchema,
  ssoStartInputSchema,
} from '@vitnode/core/tanstack/auth'
import {
  changePasswordFromResetOnApi,
  completeSsoOnApi,
  readSessionOnApi,
  requestPasswordResetOnApi,
  signInOnApi,
  signOutOnApi,
  signUpOnApi,
  startSsoOnApi,
} from '@vitnode/core/tanstack/auth/server'

/**
 * This application's auth transport: eight server functions, and nothing else.
 *
 *     browser -> server function -> @vitnode/core/tanstack/auth/server
 *                                            |
 *                                       fetcherServer -> Hono users API
 *                                            |
 *                   browser <- saveApiCookies <- Set-Cookie
 *
 * Every handler here is one line, and that is the point of the file. What a
 * mutation *means* - which schema its input is parsed by, which status maps to
 * which result, which replies may have their cookies copied onto this response -
 * lives in `@vitnode/core/tanstack/auth`, so it is stated once for every VitNode
 * install rather than once per application.
 *
 * ## Why the declarations cannot move with them
 *
 * `createServerFn` needs the module it sits in to be transformed by the Start
 * compiler on *both* sides of the render, and package code only gets that on
 * one. `vite.config.ts` externalises `@vitnode/core` from Vite's SSR pass -
 * Nitro's own Rollup run inlines the built `dist` afterwards - so the package
 * reaches the server un-compiled, where `.handler(fn)` receives one argument
 * instead of two and the call resolves to `undefined` with no error at all. It
 * would answer the browser correctly over `/_serverFn/*` and silently return
 * nothing during SSR, which is the worst of the available failures.
 * `packages/vitnode/src/tanstack/boundary.test.ts` forbids the primitive there
 * outright, and `src/tests/package-boundary.test.ts` checks the shipped `dist`
 * for it.
 *
 * The client half costs nothing either way: Start's compiler replaces each
 * handler body with an RPC stub, and the `@vitnode/core/tanstack/auth/server`
 * import - and the `server-only` marker inside it - goes with it.
 *
 * ## Every one of them is a POST, and every one has a validator
 *
 * `POST` is what puts these behind the `createCsrfMiddleware` in `src/start.ts`:
 * without it they would be unauthenticated endpoints that sign people in and out
 * of this app from another origin's page. The session read is the exception and
 * is a plain read.
 *
 * The validators are not decoration. A server function is a public same-origin
 * endpoint, so its input is whatever a caller posts - not whatever the form
 * collected - and these values reach an API path (`providerId`) and a credential
 * check (`email`, `password`). The schemas are core's, so both frontends parse
 * the same bounds.
 */

/**
 * The visitor's session.
 *
 * Not a `POST` and not behind CSRF, because it changes nothing: it reads the
 * session cookie the request arrives with and answers who it belongs to. It
 * rejects rather than answering `{ user: null }` when the read fails - see
 * `readSessionOnApi` - and `sessionQueryOptions` in core turns that into a query
 * error rather than a sign-out.
 */
export const readSessionFn = createServerFn().handler(
  async () => await readSessionOnApi(),
)

/** Signs a visitor in. The reply carries the session cookie. */
export const signInFn = createServerFn({ method: 'POST' })
  .validator(signInInputSchema)
  .handler(async ({ data }) => await signInOnApi(data))

/** Ends the current session. The reply carries the cookie deletion. */
export const signOutFn = createServerFn({ method: 'POST' })
  .validator(signOutInputSchema)
  .handler(async ({ data }) => await signOutOnApi(data))

/** Begins an SSO sign-in and answers with the provider's authorization URL. */
export const startSsoFn = createServerFn({ method: 'POST' })
  .validator(ssoStartInputSchema)
  .handler(async ({ data }) => await startSsoOnApi(data))

/** Completes an SSO sign-in, exchanging the provider's `code` for a session. */
export const completeSsoFn = createServerFn({ method: 'POST' })
  .validator(ssoCallbackInputSchema)
  .handler(async ({ data }) => await completeSsoOnApi(data))

/** Registers a new account, which may or may not come with a session. */
export const signUpFn = createServerFn({ method: 'POST' })
  .validator(signUpInputSchema)
  .handler(async ({ data }) => await signUpOnApi(data))

/** Asks for a password-reset link to be emailed. */
export const requestPasswordResetFn = createServerFn({ method: 'POST' })
  .validator(passwordResetRequestInputSchema)
  .handler(async ({ data }) => await requestPasswordResetOnApi(data))

/** Sets a new password from a recovery link. Mints no session. */
export const changePasswordFromResetFn = createServerFn({ method: 'POST' })
  .validator(changePasswordInputSchema)
  .handler(async ({ data }) => await changePasswordFromResetOnApi(data))

/**
 * Hand the eight to `@vitnode/core/tanstack/auth`, once, at module scope.
 *
 * `src/router.tsx` imports this module for the side effect, so the registration
 * happens in both bundles before any route can run - a router is the one thing
 * every entry point loads. It is a registry of *function references*, identical
 * for every visitor and every request, so a module-level value is safe on a
 * server rendering many visitors at once; there is no session, no user and no
 * request state here.
 *
 * The `{ data }` wrapper is the whole adaptation: core speaks plain arguments,
 * and a server function takes its payload under `data`.
 */
setAuthTransport({
  changePasswordFromReset: async (input) =>
    await changePasswordFromResetFn({ data: input }),
  completeSso: async (input) => await completeSsoFn({ data: input }),
  readSession: async () => await readSessionFn(),
  requestPasswordReset: async (input) =>
    await requestPasswordResetFn({ data: input }),
  signIn: async (input) => await signInFn({ data: input }),
  signOut: async (input) => await signOutFn({ data: input }),
  signUp: async (input) => await signUpFn({ data: input }),
  startSso: async (input) => await startSsoFn({ data: input }),
})
