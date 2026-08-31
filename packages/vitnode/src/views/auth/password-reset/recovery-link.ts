import { z } from "zod";

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
 */

/**
 * The recovery token, as it may appear in a URL.
 *
 * The API generates it as `randomBytes(32).toString("base64url")` - 43
 * characters of `[A-Za-z0-9_-]` - so the character class is a true statement
 * about the value rather than a guess, and it is what excludes whitespace,
 * control characters and path separators. The length bounds are deliberately
 * loose around the real 43 so a change to the API's token generation widens
 * rather than breaks this.
 */
const recoveryTokenSchema = z
  .string()
  .min(16)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * The account the link belongs to.
 *
 * A query parameter arrives as a string, and `Number("")` is `0` while
 * `Number(true)` is `1` - so the digits are checked *before* the coercion rather
 * than after, and only a string of digits or an actual number is accepted. The
 * cap is `Number.MAX_SAFE_INTEGER` because past it two different ids compare
 * equal, which is not a value to send to a lookup.
 */
const recoveryUserIdSchema = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform(value => Number(value))
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

export const recoveryLinkSchema = z.object({
  token: recoveryTokenSchema,
  userId: recoveryUserIdSchema,
});

/** A recovery link this app is willing to act on. */
export type RecoveryLink = z.infer<typeof recoveryLinkSchema>;

/**
 * The link's two values, normalised, or `null`.
 *
 * `null` is the answer for every unusable shape - missing, empty, malformed, out
 * of range - because the screens have exactly one thing to do about all of them:
 * render the "request a reset link" form instead of the "choose a new password"
 * one. Which is what the Next.js view already does with `if (token && userId)`,
 * only spelled as a rule that a crafted `?token=%20&userId=0` cannot walk past.
 */
export const parseRecoveryLink = (input: {
  token?: unknown;
  userId?: unknown;
}): null | RecoveryLink => {
  const parsed = recoveryLinkSchema.safeParse({
    token: input.token,
    userId: input.userId,
  });

  return parsed.success ? parsed.data : null;
};
