/**
 * The two values a password-recovery email puts in the URL, judged before
 * anything is done with them.
 *
 * `/login/reset-password?token=...&userId=...` is a link in an email, which means
 * the query is the least trustworthy input on the recovery screens: anyone can
 * craft one, and the page decides *which form to render* from whether both
 * values are present. So the rule is a schema rather than a truthiness check,
 * and it lives here - pure, framework-free, with no React and no fetcher - so
 * both the Next.js view and a TanStack Start route reach the same verdict from
 * the same code.
 *
 * ## What it is not
 *
 * Not authentication. The API is the boundary and stays the boundary: it looks
 * the row up by `userId` *and* `token` *and* an unexpired `expiresAt`, and
 * answers `400 Invalid token` when any of the three does not match
 * (`users/routes/change-password.route.ts`). Nothing here can grant a password
 * change; it only decides whether a request is worth making at all, and stops a
 * crafted URL from turning into a request carrying an unbounded string or a
 * `userId` the API would have to coerce.
 *
 * ## Why the rule is written out rather than declared with `zod`
 *
 * Because of *where this runs*. A TanStack Start route's `validateSearch` and
 * `loaderDeps` are evaluated during path matching, before any chunk is fetched,
 * so they live in the client entry - the bundle every page of the application
 * downloads first. `passwordResetMode` calls this function from `loaderDeps`,
 * which made this module the client entry's only reason to hold `zod`: 112 kB
 * of schema library, on the critical path of the front page, for two values on
 * one auth route. Measured on vitnode.com, removing this edge was the single
 * largest saving left after the route graph itself was split.
 *
 * The rules below are the same rules, in the same order, with the same answers -
 * `recovery-link.test.ts` pins every case the schema version was written
 * against, including the ones that only differ if the coercion moves
 * (`Number("")` is `0`, `Number(true)` is `1`, and `Number("9007199254740993")`
 * lands one past the safe range). `zod` remains the right tool everywhere it is
 * not being paid for by a page that never reaches this flow: the auth contract's
 * mutation inputs, the API's route schemas and the Content Engine all keep it.
 */

/** A recovery link this app is willing to act on. */
export interface RecoveryLink {
  token: string;
  userId: number;
}

/**
 * The recovery token, as it may appear in a URL.
 *
 * The API generates it as `randomBytes(32).toString("base64url")` - 43
 * characters of `[A-Za-z0-9_-]` - so the character class is a true statement
 * about the value rather than a guess, and it is what excludes whitespace,
 * control characters and path separators. The length bounds are deliberately
 * loose around the real 43 so a change to the API's token generation widens
 * rather than breaks this.
 *
 * Anchored at both ends, which is what makes the class exhaustive: an unanchored
 * test would accept `../../<token>` on the strength of the token inside it.
 */
const RECOVERY_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const RECOVERY_TOKEN_MIN_LENGTH = 16;
const RECOVERY_TOKEN_MAX_LENGTH = 512;

const recoveryToken = (value: unknown): null | string =>
  typeof value === "string" &&
  value.length >= RECOVERY_TOKEN_MIN_LENGTH &&
  value.length <= RECOVERY_TOKEN_MAX_LENGTH &&
  RECOVERY_TOKEN_PATTERN.test(value)
    ? value
    : null;

/**
 * The account the link belongs to.
 *
 * A query parameter arrives as a string, and `Number("")` is `0` while
 * `Number(true)` is `1` - so the digits are checked *before* the coercion rather
 * than after, and only a string of digits or an actual number is accepted. The
 * cap is `Number.MAX_SAFE_INTEGER` because past it two different ids compare
 * equal, which is not a value to send to a lookup - and it is checked after the
 * coercion, because that is where the collapse happens:
 * `Number("9007199254740993")` is `9007199254740992`, one past the range.
 *
 * `Number.isInteger` is what rejects `NaN`, `Infinity` and a fractional number
 * that arrived as a number rather than as a string - the router's default search
 * parsing is `JSON.parse` per value, so `?userId=1.5` reaches this as the number
 * `1.5` and never as a string.
 */
const RECOVERY_USER_ID_PATTERN = /^\d+$/;

const recoveryUserId = (value: unknown): null | number => {
  const coerced =
    typeof value === "number"
      ? value
      : typeof value === "string" && RECOVERY_USER_ID_PATTERN.test(value)
        ? Number(value)
        : null;

  return coerced !== null &&
    Number.isInteger(coerced) &&
    coerced > 0 &&
    coerced <= Number.MAX_SAFE_INTEGER
    ? coerced
    : null;
};

/**
 * The link's two values, normalised, or `null`.
 *
 * `null` is the answer for every unusable shape - missing, empty, malformed, out
 * of range - because the screens have exactly one thing to do about all of them:
 * render the "request a reset link" form instead of the "choose a new password"
 * one. Which is what the Next.js view already does with `if (token && userId)`,
 * only spelled as a rule that a crafted `?token=%20&userId=0` cannot walk past.
 *
 * Both halves are judged before either is used, and a single `null` fails the
 * pair: there is no shape in which half a link travels onward.
 */
export const parseRecoveryLink = (input: {
  token?: unknown;
  userId?: unknown;
}): null | RecoveryLink => {
  const token = recoveryToken(input.token);
  const userId = recoveryUserId(input.userId);

  return token === null || userId === null ? null : { token, userId };
};
