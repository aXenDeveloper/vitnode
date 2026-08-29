/**
 * What the auth routes read out of their URLs.
 *
 * Pure functions, no router and no React, so each route's search contract can be
 * stated and tested without mounting anything - the same split `./recovery`
 * makes for `/login/reset-password` and `../search/route-search` for `/search`.
 * `route-search.test.ts` beside it is the test.
 *
 * ## Why these are normalisers rather than schemas
 *
 * Both of these URLs are written by somebody other than this application - one
 * by whoever composed a link to the login page, the other by an OAuth provider -
 * and TanStack's default search parsing is `JSON.parse` per value. So
 * `?returnTo=123` reaches `validateSearch` as the **number** `123`, and
 * `?state=48291` as the number `48291`.
 *
 * A `z.object({ returnTo: z.string().optional() })` throws on both, and a
 * `validateSearch` that throws is a route that renders its error boundary. That
 * is the wrong answer twice over: a crafted `?returnTo=` should produce an
 * ordinary login page, not a broken one, and a numeric OAuth `state` should
 * complete the sign-in the visitor is in the middle of. Neither value is
 * *trusted* by being kept - `sanitizeReturnTo` and `parseSsoCallback` judge them
 * afterwards, and they are the only things that do.
 *
 * So the rule is the one `normalizePasswordResetSearch` already follows:
 *
 * - **Drop what cannot be a value**, as an absent key rather than `undefined`,
 *   so the router has nothing to write back and the URL settles to the clean
 *   one.
 * - **Never coerce what can.** A kept value is the value that arrived, byte for
 *   byte, so `stringify(parse(url)) === url` and the canonical-location check
 *   the server performs does not answer a 307.
 */

/** A non-empty string as it arrived, or nothing at all. */
const keptString = <K extends string>(
  key: K,
  value: unknown,
): Partial<Record<K, string>> =>
  typeof value === "string" && value !== ""
    ? ({ [key]: value } as Record<K, string>)
    : {};

/**
 * `/login`'s search parameters.
 *
 * One optional value, and it is deliberately typed as a plain `string` rather
 * than something narrower. Whether a target is somewhere this application may
 * send a browser is `sanitizeReturnTo`'s single answer, and stating it again as
 * a type would be a second rule that can disagree with the first.
 */
export interface LoginSearch {
  returnTo?: string;
}

/**
 * `/login`'s search schema.
 *
 * Everything that is not a non-empty string is dropped, which is the correct
 * answer for `?returnTo=` (empty), `?returnTo=123` (a number, after
 * `JSON.parse`) and `?returnTo` (absent) alike: no target was named, so the
 * post-sign-in destination is the default one.
 *
 * A kept value is *not* a safe value. It is judged by `sanitizeReturnTo` at the
 * point it is used - which is where an open redirect would actually happen -
 * and rejecting it here instead would only mean a visitor following a crafted
 * link saw an error page rather than the login form they can still use.
 */
export const normalizeLoginSearch = (
  input: Record<string, unknown>,
): LoginSearch => keptString("returnTo", input.returnTo);

/**
 * What an SSO provider may put in the callback URL.
 *
 * Every field optional and none of them constrained, because which half arrives
 * is the provider's decision - `code` and `state` when the visitor approved,
 * `error` when they did not - and a schema demanding either would turn a
 * legitimate denial into a router error.
 */
export interface SsoCallbackSearch {
  code?: string;
  error?: string;
  state?: string;
}

/**
 * `/login/sso/$providerId`'s search schema.
 *
 * The values are bounded, classified and paired with the provider id by
 * `parseSsoCallback`, which already `safeParse`s them and answers
 * `invalid_callback` for anything it cannot use. This exists so that the route
 * gets that far: without it, a provider whose `state` happens to be all digits
 * fails `validateSearch` and the callback never runs at all.
 */
export const normalizeSsoCallbackSearch = (
  input: Record<string, unknown>,
): SsoCallbackSearch => ({
  ...keptString("code", input.code),
  ...keptString("error", input.error),
  ...keptString("state", input.state),
});
