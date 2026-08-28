import { z } from 'zod'

/**
 * What the auth mutations accept, and what they answer with.
 *
 * Pure and framework-free on purpose: no `createServerFn`, no fetcher, no
 * cookies. Everything in here is a schema or a total function from an HTTP
 * status to a finite result, which is what makes the interesting half of the
 * auth transport testable without a server, a database or a browser - and what
 * keeps the server functions in `#/lib/auth/mutations` down to "call the API,
 * copy the cookies, map the status".
 *
 * The results are closed unions rather than the API's own JSON. A component
 * gets `{ ok: false, reason: 'access_denied' }`, never a body it has to guess
 * the shape of and never an internal message - a 500 from the API carries the
 * failing URL and the exception text, and none of that belongs in a browser.
 */

/**
 * A provider id, as it may appear in a URL path.
 *
 * The API's own schema is `z.string()`, and the fetcher interpolates the value
 * into the request path *without encoding it* (see `buildApiUrl`), so an
 * unchecked id is a path-traversal primitive: `../../..` would resolve to a
 * different API endpoint entirely. A conservative slug - what every shipped
 * adapter uses (`google`, `discord`, `facebook`) - removes the question rather
 * than answering it, since none of `/`, `.` or `%` survives it.
 */
export const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)

/**
 * Email and password, plus the session flavour to mint.
 *
 * The smallest equivalent of `zodSignInSchema` on the API's sign-in route,
 * written out rather than imported: that module pulls in `SessionModel`,
 * `UserModel` and the Hono runtime with them, and this schema is reachable from
 * the browser bundle. `.toLowerCase()` mirrors what the API does to the address
 * before it looks a user up, so the value sent matches the value stored.
 *
 * `isAdmin` selects the AdminCP session rather than the public one, exactly as
 * the legacy server action passed it through.
 */
export const signInInputSchema = z.object({
  email: z.email().toLowerCase(),
  isAdmin: z.boolean().optional(),
  password: z.string().min(1).max(1024),
})

export type SignInInput = z.infer<typeof signInInputSchema>

/** Which session to end. Mirrors the API's sign-out body. */
export const signOutInputSchema = z.object({
  isAdmin: z.boolean().optional(),
})

export type SignOutInput = z.infer<typeof signOutInputSchema>

/** Which provider to start a sign-in with. */
export const ssoStartInputSchema = z.object({
  providerId: providerIdSchema,
})

export type SsoStartInput = z.infer<typeof ssoStartInputSchema>

/**
 * What the provider sends the visitor back with.
 *
 * `code` and `state` are bounded but otherwise unconstrained: `state` is
 * verified cryptographically by the API against the `--state-sso` cookie it
 * minted, and re-deriving its format here would be a second, weaker copy of
 * that check which breaks the flow the day the API's state generation changes.
 * The caps exist so a crafted callback URL cannot make this app forward an
 * unbounded string; every real provider's values fit inside them.
 */
export const ssoCallbackInputSchema = z.object({
  code: z.string().min(1).max(2048),
  providerId: providerIdSchema,
  state: z.string().min(1).max(2048),
})

export type SsoCallbackInput = z.infer<typeof ssoCallbackInputSchema>

/**
 * ## The four results, and how the shared screens read them
 *
 * `{ ok: true }` or one failure from a closed list, so a component branches on
 * a literal rather than on a status code or an API body. That is also the seam
 * with `@vitnode/core`'s shared auth screens, whose props speak the legacy
 * vocabulary: the caller wiring a screen to these translates once, at the call
 * site, and nothing here has to know which UI it is feeding.
 *
 *     signIn        { ok: true }                        -> navigate
 *                   { reason: 'access_denied' }         -> `signInFormOutcome`'s
 *                                                          `{ message: 'access_denied' }`
 *                   { reason: 'server_error' }          -> `{ message: 'Internal Server Error' }`
 *
 *     completeSso   { ok: true }                        -> navigate
 *                   { reason: 'email_exists' }          -> `SSOCallbackFailure` `'email_exists'`
 *                   anything else                       -> `SSOCallbackFailure` `'unknown'`
 *
 * The extra reasons exist because the API distinguishes them and throwing that
 * away here would be irreversible: `invalid_state` is a round trip that expired
 * or was tampered with (start over), `unknown_provider` is an adapter this
 * install does not have configured (a deployment mistake, not a visitor's). A
 * screen that only has two states collapses them on the way in.
 */
export type SignInResult =
  { ok: false; reason: 'access_denied' | 'server_error' } | { ok: true }

export type SignOutResult = { ok: false; reason: 'server_error' } | { ok: true }

export type SsoStartResult =
  | { ok: false; reason: 'server_error' | 'unknown_provider' }
  | { ok: true; url: string }

export type CompleteSsoResult =
  | {
      ok: false
      reason:
        'email_exists' | 'invalid_state' | 'server_error' | 'unknown_provider'
    }
  | { ok: true }

/**
 * Whether a reply's cookies may be copied onto this app's response.
 *
 * 2xx only, which is the rule Next's `fetcher()` applies to `allowSaveCookies`
 * and therefore the rule the legacy flow was built on. It matters in both
 * directions: the session cookie arrives on a 201 and the deletion arrives on a
 * 200, while a 403 sign-in attempt has nothing this app should be writing to
 * the visitor's browser.
 */
export const shouldSaveApiCookies = (status: number): boolean =>
  status >= 200 && status < 300

/**
 * The sign-in route answers `201` with the session cookie attached, `403` when
 * the address is unknown or the password is wrong, and nothing else on purpose.
 * Everything unexpected - a 429 from the rate limiter, a 500 - is one
 * `server_error`, the same collapse the legacy action made, because a sign-in
 * form has exactly two things to say.
 */
export const signInResultFromStatus = (status: number): SignInResult => {
  if (status === 201) return { ok: true }
  if (status === 403) return { ok: false, reason: 'access_denied' }

  return { ok: false, reason: 'server_error' }
}

/**
 * Sign-out is `200` or it did not happen. The API deletes the cookie even when
 * it finds no session to delete, so a `200` is the only outcome a working
 * request has.
 */
export const signOutResultFromStatus = (status: number): SignOutResult =>
  status === 200 ? { ok: true } : { ok: false, reason: 'server_error' }

/**
 * An absolute `http(s)` URL - the only kind a caller may put a browser at.
 *
 * The value comes from this install's own SSO adapter, so this is not a trust
 * boundary so much as a guarantee about what leaves here: the caller performs a
 * full-document navigation to it, and a relative or `javascript:` URL reaching
 * that assignment is an XSS sink. Checked where the URL is turned into a result,
 * so a broken adapter is a `server_error` rather than a navigation.
 */
export const isProviderRedirectUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

/**
 * The provider's authorization URL, or why there is none. `404` is the API's
 * answer for a provider this install does not have configured.
 */
export const ssoStartResultFromStatus = (
  status: number,
  url: unknown,
): SsoStartResult => {
  if (status === 404) return { ok: false, reason: 'unknown_provider' }
  if (status !== 200 || !isProviderRedirectUrl(url)) {
    return { ok: false, reason: 'server_error' }
  }

  return { ok: true, url }
}

/**
 * The callback route's outcomes.
 *
 * `409` is the one a visitor can act on: the provider's email already belongs to
 * an account that was not created through it, so the answer is to sign in with a
 * password instead - which is what the legacy 409 screen offers. `400` is the
 * API rejecting the OAuth `state`, which means the round trip was tampered with
 * or simply took too long, and starting over is the only way forward.
 *
 * Reachable only for a callback that already passed
 * {@link parseSsoCallback}, which is why a missing `code` is not one of these.
 */
export const completeSsoResultFromStatus = (
  status: number,
): CompleteSsoResult => {
  if (status === 200) return { ok: true }
  if (status === 400) return { ok: false, reason: 'invalid_state' }
  if (status === 404) return { ok: false, reason: 'unknown_provider' }
  if (status === 409) return { ok: false, reason: 'email_exists' }

  return { ok: false, reason: 'server_error' }
}

export type ParsedSsoCallback =
  | {
      ok: false
      reason: 'access_denied' | 'invalid_callback' | 'provider_error'
    }
  | { ok: true; params: SsoCallbackInput }

const ssoCallbackQuerySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  state: z.string().optional(),
})

/** `URLSearchParams` and a plain search object, as one shape to validate. */
const asQueryRecord = (query: unknown): unknown =>
  query instanceof URLSearchParams ? Object.fromEntries(query) : query

/**
 * What the provider put in the callback URL, judged before any of it is sent on.
 *
 * The provider decides which half of the query it sends - `code` and `state`
 * when the visitor approved, `error` when they did not - so the caller cannot
 * know which shape it has without asking. The error branch comes first because
 * OAuth allows both to be present and the error is the meaningful one.
 *
 * `error` is *classified*, never carried through: `access_denied` is the visitor
 * declining at the provider and gets its own screen, and everything else becomes
 * one `provider_error`, so no provider-authored string reaches the UI.
 */
export const parseSsoCallback = ({
  providerId,
  query,
}: {
  providerId: unknown
  query: unknown
}): ParsedSsoCallback => {
  const parsedQuery = ssoCallbackQuerySchema.safeParse(asQueryRecord(query))
  const { code, error, state } = parsedQuery.success ? parsedQuery.data : {}

  if (error !== undefined && error !== '') {
    return {
      ok: false,
      reason: error === 'access_denied' ? 'access_denied' : 'provider_error',
    }
  }

  const params = ssoCallbackInputSchema.safeParse({ code, providerId, state })
  if (!params.success) return { ok: false, reason: 'invalid_callback' }

  return { ok: true, params: params.data }
}
