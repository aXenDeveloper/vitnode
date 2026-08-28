import type { RecoveryLink } from '@vitnode/core/views/auth/password-reset/recovery-link'

import { parseRecoveryLink } from '@vitnode/core/views/auth/password-reset/recovery-link'

/**
 * What `/login/reset-password` reads out of its URL, and what it turns that
 * into.
 *
 * Pure functions, no transport and no React, so the route's whole contract can
 * be stated and tested without a router - the same split `lib/search/search-request.ts`
 * makes for `/search`. `src/tests/auth-routes.test.ts` is the test.
 *
 * One route serves two screens, and this module is where that is decided:
 *
 *     /login/reset-password                       -> ask for a link
 *     /login/reset-password?token=..&userId=..    -> choose a new password
 *
 * which is exactly what the Next.js `PasswordResetView` does with
 * `if (token && userId)`, only spelled as a rule a crafted URL cannot walk past.
 */

/**
 * The two search parameters, in the shape the *router* produces them.
 *
 * `userId` is `number | string` rather than the `string` the URL literally
 * contains, and that is not laxness - it is the only spelling that survives a
 * round trip. TanStack's default search parsing is `JSON.parse` per value, so
 * `?userId=123` reaches `validateSearch` as the **number** `123`; the default
 * stringifier is its inverse, and re-serialising the *string* `'123'` produces
 * `?userId=%22123%22`. The server compares the location it rebuilds against the
 * one that arrived (`loadServerRoute`) and redirects when they differ, so
 * coercing here would turn every recovery link into a 307 to a quoted URL.
 *
 * `token` has no such problem: the stringifier returns a string unchanged unless
 * it parses as JSON, and a base64url token does not.
 */
export interface PasswordResetSearch {
  token?: string
  userId?: number | string
}

/**
 * The route's search schema - a normaliser rather than a validator, for the same
 * reason `/search`'s is.
 *
 * This URL is typed by strangers and pasted out of emails, so every malformed
 * spelling has to render *a* page rather than an error boundary: the answer to
 * `?userId=true`, `?token=`, or a missing half is the request form, which is the
 * page a visitor who needs a new link wants anyway.
 *
 * Two rules, and both matter:
 *
 * - **Drop what cannot be a value.** An unusable parameter is returned as an
 *   *absent* key, so the router has nothing to write back and the URL settles to
 *   the clean one - `/search`'s trick, and what stops junk from riding along
 *   through the reset flow.
 * - **Never coerce what can.** A kept value is the value that arrived, byte for
 *   byte, so `stringify(parse(url)) === url` and the canonical-location check
 *   does not redirect. See {@link PasswordResetSearch}.
 *
 * Judging whether the pair is *usable* is deliberately not done here - that is
 * {@link passwordResetMode}, through core's `parseRecoveryLink`, so the rule
 * lives once and both frameworks apply it.
 */
export const normalizePasswordResetSearch = (
  input: Record<string, unknown>,
): PasswordResetSearch => {
  const { token, userId } = input

  return {
    ...(typeof token === 'string' && token !== '' ? { token } : {}),
    ...(typeof userId === 'number' ||
    (typeof userId === 'string' && userId !== '')
      ? { userId }
      : {}),
  }
}

/**
 * Which of the two screens this URL asks for.
 *
 * A union rather than a boolean, so the change-password branch carries the
 * *parsed* link and there is no way to reach that screen without one. Which is
 * the whole of "do not pass partially present credentials to the API":
 * `parseRecoveryLink` answers `null` unless both values are present and both are
 * well formed, and this type has no shape in which half a link could travel.
 *
 * Not an authorization decision. The API looks the recovery row up by `userId`
 * *and* `token` *and* an unexpired `expiresAt` and answers `400` when any of the
 * three does not match; this only decides which form is worth rendering.
 */
export type PasswordResetMode =
  { link: RecoveryLink; mode: 'change' } | { mode: 'request' }

export const passwordResetMode = (
  search: PasswordResetSearch,
): PasswordResetMode => {
  const link = parseRecoveryLink(search)

  return link ? { link, mode: 'change' } : { mode: 'request' }
}

/**
 * The strings the request form renders.
 *
 * `core.global` because the root's provider is replaced by the route's, and the
 * error toasts read `core.global.errors.*` from it. `core.auth.sign_up` because
 * both recovery screens borrow the email and password field labels from the
 * registration form - which is what the Next.js view's two `I18nProvider`s
 * already declare.
 *
 * `core.auth.reset_password` is in the *base* set rather than the request-only
 * one because the page's title comes from it in **both** modes, exactly as the
 * Next.js route's `generateMetadata` does. Warming it in change mode is one
 * seven-string namespace, and the alternative is a differently-titled tab
 * depending on which half of the flow a visitor is in.
 */
const PASSWORD_RESET_BASE_NAMESPACES = [
  'core.global',
  'core.auth.sign_up',
  'core.auth.reset_password',
] as const

/** The base set, plus the change-password screen's own copy. */
const CHANGE_PASSWORD_NAMESPACES = [
  ...PASSWORD_RESET_BASE_NAMESPACES,
  'core.auth.change_password',
] as const

/**
 * What to warm, and what to mount - one function, so the loader and the provider
 * cannot ask for different sets.
 *
 * They must not: `RouteMessages` reads the entry back with `useSuspenseQuery`
 * over the same `intlQueryOptions`, and the namespace list is part of the query
 * key. A provider asking for a set nobody warmed suspends the whole response.
 */
export const passwordResetNamespaces = (
  mode: PasswordResetMode['mode'],
): readonly string[] =>
  mode === 'change'
    ? CHANGE_PASSWORD_NAMESPACES
    : PASSWORD_RESET_BASE_NAMESPACES

/**
 * Whether this deployment has password recovery at all.
 *
 * The API sends the reset link through the configured email adapter, so with no
 * adapter there is no flow - and the Next.js view answers `notFound()` rather
 * than rendering a form whose submit could never arrive. Preserved here as a
 * named predicate over the deployment configuration, so the route reads as the
 * rule rather than as a negated flag.
 *
 * Note what `isEmail: false` covers: it is also what
 * `ANONYMOUS_MIDDLEWARE_CONFIG` says when the configuration could not be read at
 * all. On this route that means an API outage renders the 404 rather than an
 * error screen - a degradation, but the safe direction, and one that follows
 * from Stage 6's decision that a failed configuration read must not blank the
 * auth pages. Changing it would mean teaching that read to distinguish "no
 * adapter" from "we could not ask".
 */
export const hasPasswordRecovery = ({
  isEmail,
}: {
  isEmail: boolean
}): boolean => isEmail
