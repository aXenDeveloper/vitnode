import '@tanstack/react-start/server-only'
import type { usersModule } from '@vitnode/core/api/modules/users/users.module'

import { clientModule } from '@vitnode/core/lib/fetcher-client'
import { CAPTCHA_TOKEN_HEADER } from '@vitnode/core/lib/fetcher/request-context'

import type {
  ChangePasswordInput,
  ChangePasswordResult,
  CompleteSsoResult,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  SignInInput,
  SignInResult,
  SignOutInput,
  SignOutResult,
  SignUpInput,
  SignUpResult,
  SsoCallbackInput,
  SsoStartInput,
  SsoStartResult,
} from '#/lib/auth/contract'

import {
  changePasswordResultFromStatus,
  completeSsoResultFromStatus,
  passwordResetRequestResultFromStatus,
  shouldSaveApiCookies,
  signInResultFromStatus,
  signOutResultFromStatus,
  signUpResultFromStatus,
  ssoStartResultFromStatus,
} from '#/lib/auth/contract'
import { fetcherServer, saveApiCookies } from '#/server/fetcher.server'

/**
 * The auth mutations against the Hono users API - the half that can only run on
 * a server.
 *
 *     server function -> here -> fetcherServer -> Hono users API
 *                                                      |
 *                   browser <- saveApiCookies <- Set-Cookie
 *
 * Split out of `#/lib/auth/mutations` for the same reason
 * `search-feed.server.ts` is split out of `lib/search/feed.ts`: that
 * module is imported by the browser bundle, and this one imports the request
 * scope (`getRequestHeaders`, `setCookie`) and the `server-only` marker above.
 * Reached only from inside a `createServerFn` handler, which is what keeps it -
 * and the marker - out of the client build.
 *
 * The API is unchanged and unrelaxed: it still hashes the password, mints the
 * session, verifies the OAuth `state` against its own cookie and decides every
 * status. Everything here is transport - forward the request state, copy the
 * cookies back, and turn a status into one of the finite results in
 * `#/lib/auth/contract`.
 */

/**
 * The users module by type only, so nothing the API needs at runtime - Hono,
 * Drizzle, the plugin tree - is pulled in by a value import. `clientModule`
 * keeps the route paths, methods and response schemas fully typed while
 * carrying just the `pluginId` the fetcher reads.
 */
const users = clientModule<typeof usersModule>('@vitnode/core')

/**
 * The API's reply, or `null` when the call never produced one.
 *
 * `rawApiFetch` *throws* on a 500 rather than returning it, with the failing URL
 * and the server's error text in the message, and a fetch to a server that is
 * not listening throws too. Both have to be caught: an error escaping a server
 * function is serialized back to the browser, which would put exactly that text
 * in front of a visitor. It is logged where a server log is the right place for
 * it, and `null` becomes the same `server_error` any other unexpected status
 * maps to.
 */
const callUsersApi = async (
  call: () => Promise<Response>,
): Promise<null | Response> => {
  try {
    return await call()
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[auth] users API call failed', error)

    return null
  }
}

/**
 * A reply's body, as JSON, or `undefined`.
 *
 * A body that is not JSON - an HTML error page from something in front of the
 * API, an empty response - makes `json()` throw, and an exception escaping a
 * server function is serialized back to the browser. `undefined` fails the
 * `201` schema instead, which the caller already reads as a `server_error`.
 */
const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/**
 * A reply's body as text, or `""`.
 *
 * Only ever handed to core's `signUpConflictReason`, which classifies it and
 * throws it away; `""` classifies as `"unknown"`, which is the right answer for a
 * conflict nobody could read.
 */
const readText = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/**
 * Copies the session, device and SSO-state cookies the API just minted onto this
 * app's response.
 *
 * 2xx only - see `shouldSaveApiCookies`, which is the rule Next's
 * `allowSaveCookies` applies and therefore the one the legacy flow was built on.
 * Guarded rather than unconditional because `saveApiCookies` writes every cookie
 * a response carries, so it is only ever handed a reply this app decided to
 * trust.
 */
const saveCookiesFrom = (response: Response): void => {
  if (shouldSaveApiCookies(response.status)) saveApiCookies(response)
}

/**
 * Signs a visitor in with an email and a password.
 *
 * `201` with the session cookie attached, `403` for an unknown address or a
 * wrong password. The cookie is the entire point of the round trip, so it is
 * copied before anything looks at the status.
 */
export const signInOnApi = async (data: SignInInput): Promise<SignInResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: data },
      method: 'post',
      module: 'users',
      path: '/sign_in',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  saveCookiesFrom(response)

  return signInResultFromStatus(response.status)
}

/**
 * Ends the current session.
 *
 * The request has to carry the visitor's cookies - that is how the API knows
 * which session row to delete - and the reply's `Set-Cookie` has to come back,
 * because that *is* the deletion. Hono spells it `name=; Max-Age=0`, which
 * `parseSetCookies` preserves as `maxAge: 0`; dropping it would leave an empty
 * cookie in the browser until it closed.
 */
export const signOutOnApi = async (
  data: SignOutInput,
): Promise<SignOutResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: { isAdmin: data.isAdmin ?? false } },
      method: 'delete',
      module: 'users',
      path: '/sign_out',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  saveCookiesFrom(response)

  return signOutResultFromStatus(response.status)
}

/**
 * Starts an SSO sign-in: asks the API for the provider's authorization URL.
 *
 * The reply carries a cookie as well as a URL - the API mints the OAuth `state`
 * and stores its hash in a short-lived `--state-sso` cookie - so this is a
 * mutation with a `Set-Cookie` like the others, and losing that cookie means the
 * callback fails its state check. Which is the whole reason it goes through a
 * server function rather than a browser fetch.
 */
export const startSsoOnApi = async (
  data: SsoStartInput,
): Promise<SsoStartResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { params: { providerId: data.providerId } },
      method: 'post',
      module: 'users/sso',
      path: '/{providerId}',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  saveCookiesFrom(response)

  if (response.status !== 200) {
    return ssoStartResultFromStatus(response.status, undefined)
  }

  const { url } = await response.json()

  return ssoStartResultFromStatus(response.status, url)
}

/**
 * Completes an SSO sign-in with what the provider sent the visitor back with.
 *
 * The API does all of the security-relevant work and keeps doing it: it verifies
 * `state` against the `--state-sso` cookie this request forwards, deletes that
 * cookie, exchanges the `code` with the provider and mints the session. This
 * layer validates the shape of the three values, forwards them, and copies the
 * session cookie back.
 */
export const completeSsoOnApi = async (
  data: SsoCallbackInput,
): Promise<CompleteSsoResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: {
        params: { providerId: data.providerId },
        query: { code: data.code, state: data.state },
      },
      method: 'get',
      module: 'users/sso',
      path: '/{providerId}/callback',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  saveCookiesFrom(response)

  return completeSsoResultFromStatus(response.status)
}

/**
 * The captcha header, or nothing at all.
 *
 * `useCaptcha` reports itself ready with an empty token when this deployment has
 * no captcha configured, and the API's `captchaMiddleware` short-circuits in
 * exactly that case - but only if the header is *absent*. An empty
 * `x-vitnode-captcha-token` is a present header with no token, which a configured
 * deployment would reject as `400 "Captcha token is required"`. So the absence is
 * the meaningful part, which is why this is a spread and not a value.
 *
 * The header name comes from `@vitnode/core`, where the middleware reads it, so
 * this app never spells it out.
 */
const captchaHeaders = (captchaToken: string): Record<string, string> =>
  captchaToken ? { [CAPTCHA_TOKEN_HEADER]: captchaToken } : {}

/**
 * Registers a new account.
 *
 * The one mutation here whose success may or may not be a session, and the reason
 * the cookies are copied before the status is looked at. On a deployment with no
 * email adapter the API marks the account verified and calls
 * `createSessionByUserId` on the same request, so the `201` carries a
 * `Set-Cookie` this server has to forward - lose it and the visitor is registered
 * and immediately anonymous. On a deployment *with* one, the same `201` carries
 * no session and `emailVerified: false` says so.
 *
 * The two bodies that are read are read for different reasons: the `201` because
 * the caller needs the address and the flag, and the `409` because the API puts
 * the conflicting field's name in its text. Neither string is forwarded - the
 * `409` is classified by core's own `signUpConflictReason` and the `201` is parsed
 * by a schema.
 */
export const signUpOnApi = async ({
  captchaToken,
  ...body
}: SignUpInput): Promise<SignUpResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      additionalHeaders: captchaHeaders(captchaToken),
      args: { body },
      method: 'post',
      module: 'users',
      path: '/sign_up',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  saveCookiesFrom(response)

  if (response.status === 201) {
    return signUpResultFromStatus(201, { body: await readJson(response) })
  }

  if (response.status === 409) {
    return signUpResultFromStatus(409, { conflict: await readText(response) })
  }

  return signUpResultFromStatus(response.status)
}

/**
 * Asks the API to email a password-reset link.
 *
 * No cookies to copy: this route mints nothing, and `saveApiCookies` writes every
 * cookie a response carries, so it is not called for a response that has no
 * business setting one.
 *
 * Nothing is read off the reply either, and nothing could be: the API answers
 * `201` whether or not the address belongs to an account. Preserving that
 * silence is the point - see `passwordResetRequestResultFromStatus`.
 */
export const requestPasswordResetOnApi = async ({
  captchaToken,
  email,
}: PasswordResetRequestInput): Promise<PasswordResetRequestResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      additionalHeaders: captchaHeaders(captchaToken),
      args: { body: { email } },
      method: 'post',
      module: 'users',
      path: '/reset-password',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  return passwordResetRequestResultFromStatus(response.status)
}

/**
 * Sets a new password from a recovery link.
 *
 * The API does all of the security-relevant work and keeps doing it: it looks the
 * recovery row up by `userId` *and* `token` *and* an unexpired `expiresAt`,
 * rejects the request when any of the three does not match, hashes the new
 * password and deletes the row. This layer validates the shape of the three
 * values and maps the status.
 *
 * **No session is minted and none is copied.** The route answers `201` with no
 * `Set-Cookie`, so a visitor who has just changed their password is still signed
 * out - which is why this is the one mutation here that does not go anywhere near
 * `saveCookiesFrom`, and why a caller must not refresh a session around it.
 */
export const changePasswordFromResetOnApi = async (
  data: ChangePasswordInput,
): Promise<ChangePasswordResult> => {
  const response = await callUsersApi(async () =>
    fetcherServer(users, {
      args: { body: data },
      method: 'post',
      module: 'users',
      path: '/change-password',
    }),
  )

  if (!response) return { ok: false, reason: 'server_error' }

  return changePasswordResultFromStatus(response.status)
}
