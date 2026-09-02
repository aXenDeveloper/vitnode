import { z } from "zod";

import { RATE_LIMIT_STATUS } from "@/lib/fetcher/rate-limit";
import { signUpConflictReason } from "@/views/auth/sign-up/form/schema";

/**
 * What the auth mutations accept, and what they answer with.
 *
 * Pure and framework-free on purpose: no `createServerFn`, no fetcher, no
 * cookies. Everything in here is a schema or a total function from an HTTP
 * status to a finite result, which is what makes the interesting half of the
 * auth transport testable without a server, a database or a browser - and what
 * keeps the server handlers in `./server` down to "call the API,
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
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/);

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
});

export type SignInInput = z.infer<typeof signInInputSchema>;

/** Which session to end. Mirrors the API's sign-out body. */
export const signOutInputSchema = z.object({
  isAdmin: z.boolean().optional(),
});

export type SignOutInput = z.infer<typeof signOutInputSchema>;

/** Which provider to start a sign-in with. */
export const ssoStartInputSchema = z.object({
  providerId: providerIdSchema,
});

export type SsoStartInput = z.infer<typeof ssoStartInputSchema>;

/**
 * What the provider sends the visitor back with.
 *
 * `code` and `state` are bounded but otherwise unconstrained: `state` is
 * verified cryptographically by the API against the `--state-sso` cookie it
 * minted, and re-deriving its format here would be a second, weaker copy of
 * that check which breaks the flow the day the API's state generation changes.
 * The caps exist so a crafted callback URL cannot make an application forward an
 * unbounded string; every real provider's values fit inside them.
 */
export const ssoCallbackInputSchema = z.object({
  code: z.string().min(1).max(2048),
  providerId: providerIdSchema,
  state: z.string().min(1).max(2048),
});

export type SsoCallbackInput = z.infer<typeof ssoCallbackInputSchema>;

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
  { ok: false; reason: "access_denied" | "server_error" } | { ok: true };

export type SignOutResult =
  { ok: false; reason: "server_error" } | { ok: true };

export type SsoStartResult =
  | { ok: false; reason: "server_error" | "unknown_provider" }
  | { ok: true; url: string };

export type CompleteSsoResult =
  | {
      ok: false;
      reason:
        "email_exists" | "invalid_state" | "server_error" | "unknown_provider";
    }
  | { ok: true };

/**
 * Re-exported from `./sign-up-session`, which is where it lives now.
 *
 * It reads {@link SignUpResult} and nothing else, so it needs no schema - and
 * being the only *value* `./actions` took from this module, it was the edge
 * that put `zod` on the public shell's path. Kept exported here so every
 * existing importer, this package's barrel included, is unaffected.
 */
export { shouldRefreshSessionAfterSignUp } from "./sign-up-session";

/**
 * Whether a session response can be read as a session at all.
 *
 * The distinction this migration got wrong for a whole stage, and the reason it is a
 * named function rather than an inline `!== 200`. Two things arrive on the same
 * wire and mean opposite things:
 *
 *     200 + { user: null }   the visitor is genuinely nobody
 *     429, 500, unreachable  we do not know who the visitor is
 *
 * Collapsing the second into the first signs people out during a rate-limit
 * spike: the guard on a protected route reads `user: null`, believes it, and
 * redirects a signed-in visitor to the login page. So anything that is not a
 * `200` is a *failed read*, which the caller has to raise rather than answer.
 *
 * `200` is the session route's only declared success (`users/session.route.ts`
 * documents exactly one response), so this is the whole rule.
 */
export const isUsableSessionStatus = (status: number): boolean =>
  status === 200;

/**
 * What the browser is told when the session could not be read.
 *
 * A fixed sentence and nothing else. An error thrown out of a server function is
 * serialized back to the caller, and the errors the session read catches are not
 * fit to send: `rawApiFetch` throws on a 500 with the failing API URL and the
 * server's own error text in the message. The detail is logged where a server
 * log is the right place for it.
 *
 * Here rather than beside the read itself so a host can recognise it - and a
 * test assert on it - without importing anything server-only.
 */
export const SESSION_UNAVAILABLE = "The session could not be read.";

/**
 * The sign-in route answers `201` with the session cookie attached, `403` when
 * the address is unknown or the password is wrong, and nothing else on purpose.
 * Everything unexpected - a 429 from the rate limiter, a 500 - is one
 * `server_error`, the same collapse the legacy action made, because a sign-in
 * form has exactly two things to say.
 */
export const signInResultFromStatus = (status: number): SignInResult => {
  if (status === 201) return { ok: true };
  if (status === 403) return { ok: false, reason: "access_denied" };

  return { ok: false, reason: "server_error" };
};

/**
 * Sign-out is `200` or it did not happen. The API deletes the cookie even when
 * it finds no session to delete, so a `200` is the only outcome a working
 * request has.
 */
export const signOutResultFromStatus = (status: number): SignOutResult =>
  status === 200 ? { ok: true } : { ok: false, reason: "server_error" };

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
  if (typeof value !== "string") return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
};

/**
 * The provider's authorization URL, or why there is none. `404` is the API's
 * answer for a provider this install does not have configured.
 */
export const ssoStartResultFromStatus = (
  status: number,
  url: unknown,
): SsoStartResult => {
  if (status === 404) return { ok: false, reason: "unknown_provider" };
  if (status !== 200 || !isProviderRedirectUrl(url)) {
    return { ok: false, reason: "server_error" };
  }

  return { ok: true, url };
};

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
  if (status === 200) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid_state" };
  if (status === 404) return { ok: false, reason: "unknown_provider" };
  if (status === 409) return { ok: false, reason: "email_exists" };

  return { ok: false, reason: "server_error" };
};

export type ParsedSsoCallback =
  | {
      ok: false;
      reason: "access_denied" | "invalid_callback" | "provider_error";
    }
  | { ok: true; params: SsoCallbackInput };

const ssoCallbackQuerySchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
  state: z.string().optional(),
});

/** `URLSearchParams` and a plain search object, as one shape to validate. */
const asQueryRecord = (query: unknown): unknown =>
  query instanceof URLSearchParams ? Object.fromEntries(query) : query;

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
  providerId: unknown;
  query: unknown;
}): ParsedSsoCallback => {
  const parsedQuery = ssoCallbackQuerySchema.safeParse(asQueryRecord(query));
  const { code, error, state } = parsedQuery.success ? parsedQuery.data : {};

  if (error !== undefined && error !== "") {
    return {
      ok: false,
      reason: error === "access_denied" ? "access_denied" : "provider_error",
    };
  }

  const params = ssoCallbackInputSchema.safeParse({ code, providerId, state });
  if (!params.success) return { ok: false, reason: "invalid_callback" };

  return { ok: true, params: params.data };
};

/**
 * ## Registration and password recovery
 *
 * Three more mutations, and the same shape as the four above: a schema for what
 * a browser may send, and a total function from an HTTP status to a finite
 * result. What is new is that two of them carry a captcha token and one of them
 * can mint a session, so the notes below are about those two facts.
 */

/**
 * A solved captcha token, as it arrives from the widget.
 *
 * `""` is accepted and meaningful: `useCaptcha` reports itself ready with no
 * token when this deployment has no captcha configured, and the API's
 * `captchaMiddleware` is a no-op in exactly that case. So an empty string is
 * "there was nothing to solve", and it is the transport's job to send no header
 * rather than an empty one.
 *
 * The cap is generous because the tokens are: a Turnstile response is around
 * 2 KB and a reCAPTCHA v3 one is longer still. It exists so a crafted call
 * cannot make this server forward an unbounded header.
 */
const captchaTokenSchema = z.string().max(8192).default("");

/**
 * What registration accepts.
 *
 * The API's own rules, restated rather than imported, for the reason the sign-in
 * schema gives: `users/routes/sign-up.route.ts` pulls in `UserModel`,
 * `PasswordModel` and the Hono runtime with them, and this module is reachable
 * from the browser bundle. Every bound here is the API's:
 *
 *     email       z.email().toLowerCase()          identical
 *     name        min 3, no doubled spaces, and the character class from
 *                 `nameRegex` - `[\p{L}\p{N}._@ -]`
 *     password    min 8 (the *form* asks for more; see
 *                 `createPasswordZodSchema` in @vitnode/core)
 *     newsletter  optional boolean
 *
 * The maxima are this layer's own and have no counterpart on the API, which
 * bounds none of these: 32 characters of name because that is what the
 * registration form allows, and 1024 of password so a submission cannot ask this
 * server to hash an unbounded string.
 */
export const signUpInputSchema = z.object({
  captchaToken: captchaTokenSchema,
  email: z.email().toLowerCase(),
  name: z
    .string()
    .min(3)
    .max(32)
    .regex(/^(?!.* {2})[\p{L}\p{N}._@ -]*$/u),
  newsletter: z.boolean().optional(),
  password: z.string().min(8).max(1024),
});

export type SignUpInput = z.infer<typeof signUpInputSchema>;

/**
 * The `201` body, validated rather than trusted.
 *
 * Two reasons it is a schema and not a cast. It decides whether the visitor is
 * now signed in - `emailVerified` is what the API branched on when it chose to
 * mint a session - so a missing or wrongly-typed field must not read as `false`
 * by accident. And the sign-up route declares its `400` and `409` without a
 * `content` block, which makes the fetcher's inferred `json()` type `unknown`;
 * parsing is how that becomes a shape rather than an assertion.
 */
const signUpSuccessSchema = z.object({
  email: z.string(),
  emailVerified: z.boolean(),
});

/**
 * What a reset request accepts. One address and the captcha the route requires.
 */
export const passwordResetRequestInputSchema = z.object({
  captchaToken: captchaTokenSchema,
  email: z.email().toLowerCase(),
});

export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestInputSchema
>;

/**
 * What a password change accepts.
 *
 * The link's two values *and* a password, validated here even though
 * `parseRecoveryLink` in `@vitnode/core` already judged the first two on the way
 * out of the URL. That is not redundancy: a server function is a public
 * same-origin endpoint, so its input is whatever a caller posts, and the
 * component that parsed the URL is not in the call path. The bounds match that
 * parser's - a base64url token, a safe-integer id - so a link the app was
 * willing to render a form for is a link this schema accepts.
 */
export const changePasswordInputSchema = z.object({
  password: z.string().min(8).max(1024),
  token: z
    .string()
    .min(16)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/),
  userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

/**
 * ## The three results
 *
 *     signUp                 { ok: true, email, emailVerified }
 *                            { reason: 'email_exists' | 'name_exists' }  -> mark a field
 *                            { reason: 'conflict' }                      -> a 409 we
 *                                                                           could not
 *                                                                           classify
 *                            { reason: 'invalid' }                       -> the API
 *                                                                           refused the
 *                                                                           body or the
 *                                                                           captcha
 *                            { reason: 'rate_limited' | 'server_error' }
 *
 *     requestPasswordReset   { ok: true }
 *                            { reason: 'invalid' | 'rate_limited' | 'server_error' }
 *
 *     changePasswordFromReset  { ok: true }
 *                              { reason: 'invalid_token' }               -> ask for a
 *                                                                           fresh link
 *                              { reason: 'rate_limited' | 'server_error' }
 *
 * `rate_limited` is kept apart from `server_error` even though today's screens
 * render both the same way. The API answers `429` with a `Retry-After` header,
 * and `notifyRateLimited` - the toast the browser fetcher raises - is a no-op on
 * a server, so a mutation that goes through a server function is the *only* place
 * that fact can be observed. Collapsing it here would make it unobservable
 * anywhere.
 *
 * `email` and `emailVerified` come back from sign-up because the caller needs
 * both: the address is printed on the "check your email" screen, and the flag is
 * the difference between a visitor who now holds a session cookie and one who
 * does not. See {@link shouldRefreshSessionAfterSignUp}.
 */
export type SignUpResult =
  | { email: string; emailVerified: boolean; ok: true }
  | {
      ok: false;
      reason:
        | "conflict"
        | "email_exists"
        | "invalid"
        | "name_exists"
        | "rate_limited"
        | "server_error";
    };

export type PasswordResetRequestResult =
  | { ok: false; reason: "invalid" | "rate_limited" | "server_error" }
  | { ok: true };

export type ChangePasswordResult =
  | { ok: false; reason: "invalid_token" | "rate_limited" | "server_error" }
  | { ok: true };

/**
 * A registration attempt, from the status and whatever body came with it.
 *
 * `201` is the route's only success, and it is the one status whose body is
 * read - through {@link signUpSuccessSchema}, so a `201` the API answered with
 * something unexpected is a `server_error` rather than a visitor who is
 * mysteriously signed in or not.
 *
 * `400` is `invalid`, and it covers two things the API spells the same way: a
 * body its schema refused, and a captcha `captchaMiddleware` refused
 * (`"Captcha token is required"`, `"Captcha validation failed"` - both `400`).
 * Neither message travels; a caller that wants to distinguish them would need
 * the API to say so, which today it does not.
 *
 * `409` goes through core's `signUpConflictReason`, the single classifier both
 * frontends use, so `"Email already exists"` becomes `email_exists` here and in
 * the Next.js server action from the same code. A `409` whose body matches
 * neither known message is `conflict`: still a conflict, just not one that can be
 * pinned to a field.
 */
export const signUpResultFromStatus = (
  status: number,
  { body, conflict }: { body?: unknown; conflict?: string } = {},
): SignUpResult => {
  if (status === 201) {
    const parsed = signUpSuccessSchema.safeParse(body);

    if (!parsed.success) return { ok: false, reason: "server_error" };

    return {
      email: parsed.data.email,
      emailVerified: parsed.data.emailVerified,
      ok: true,
    };
  }

  if (status === 400) return { ok: false, reason: "invalid" };
  if (status === 409) {
    const reason = signUpConflictReason(conflict ?? "");

    return {
      ok: false,
      reason: reason === "unknown" ? "conflict" : reason,
    };
  }
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

/**
 * A reset request's outcome.
 *
 * `201` is the route's only declared response, and the API answers it whether or
 * not the address belongs to an account and whether or not it decided to skip
 * the send because one was requested in the last five minutes. That is the
 * product's anti-enumeration behaviour and this function preserves it exactly:
 * there is no reason in {@link PasswordResetRequestResult} that could mean "no
 * such account", so no caller can accidentally reveal one.
 *
 * `400` is `invalid` - a malformed address, or a captcha the middleware refused.
 * It says nothing about whether the address exists.
 */
export const passwordResetRequestResultFromStatus = (
  status: number,
): PasswordResetRequestResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid" };
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

/**
 * A password change's outcome.
 *
 * `400` is the one a visitor can act on. The API looks the recovery row up by
 * `userId` *and* `token` *and* an unexpired `expiresAt`, and answers
 * `400 "Invalid token"` when any of the three does not match - so a wrong link, a
 * spent link and a link older than thirty minutes are one status, and "ask for a
 * fresh one" is the answer to all of them.
 *
 * Nothing here signs anybody in, because the route mints no session: it hashes
 * the new password, writes it, and deletes the recovery row. A caller must not
 * invent a session refresh around it.
 */
export const changePasswordResultFromStatus = (
  status: number,
): ChangePasswordResult => {
  if (status === 201) return { ok: true };
  if (status === 400) return { ok: false, reason: "invalid_token" };
  if (status === RATE_LIMIT_STATUS)
    return { ok: false, reason: "rate_limited" };

  return { ok: false, reason: "server_error" };
};

export { shouldSaveApiCookies } from "@/lib/fetcher/set-cookie";
