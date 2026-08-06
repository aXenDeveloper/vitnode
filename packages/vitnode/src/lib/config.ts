/**
 * Fallback used when `CRON_SECRET` is not set. It is intentionally well-known:
 * the admin integrations panel flags cron as insecure while this value is in
 * use so it is obvious a real secret must be provided in production.
 */
export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

/**
 * Fallback used when `CONTENT_PREVIEW_SECRET` is not set, and well-known for
 * the same reason as the cron one: the integrations panel flags content preview
 * as insecure while it is in use.
 *
 * The stakes are higher here than for cron. This secret is the *only* thing
 * standing between an unpublished record and anyone who can guess a URL, so a
 * deployment left on the default is one search away from publishing its drafts.
 */
export const INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET =
  "default-content-preview-secret-change-in-production";

/**
 * How much entropy a preview secret has to carry.
 *
 * 32 bytes is the block size HMAC-SHA256 keys are compared against, and it is
 * what `openssl rand -base64 32` produces. Anything shorter is a password, and
 * a password is not a signing key.
 */
export const CONTENT_PREVIEW_SECRET_MIN_BYTES = 32;

/**
 * Whether a value is good enough to sign preview links with.
 *
 * `false` for a missing secret, for the well-known fallback, and for anything
 * too short to be worth attacking a hash with. Preview is the one feature in
 * the engine whose entire access control is a signature, so a weak secret is
 * not a warning - it is an unpublished record served to anyone who reads this
 * source file.
 *
 * `TextEncoder` rather than `Buffer`, so the check runs unchanged in a browser
 * bundle and in `drizzle-kit`.
 */
export const isSecureContentPreviewSecret = (
  secret: null | string | undefined,
): boolean =>
  typeof secret === "string" &&
  secret !== INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET &&
  new TextEncoder().encode(secret).length >= CONTENT_PREVIEW_SECRET_MIN_BYTES;

/**
 * Env is read lazily via getters, not captured at module load. The standalone
 * API loads its `.env` (dotenv) only when `vitnode.api.config.ts` runs, which can
 * be after this module is first imported - reading on access ensures values like
 * `NEXT_PUBLIC_API_URL` are always current instead of frozen to their fallbacks.
 */
export const CONFIG = {
  get api(): URL {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000");
  },
  get contentPreviewSecret(): string {
    return (
      process.env.CONTENT_PREVIEW_SECRET ??
      INSECURE_DEFAULT_CONTENT_PREVIEW_SECRET
    );
  },
  get cronJobSecret(): string {
    return process.env.CRON_SECRET ?? INSECURE_DEFAULT_CRON_SECRET;
  },
  get node_development(): boolean {
    return process.env.NODE_ENV === "development";
  },
  get web(): URL {
    return new URL(process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000");
  },
};
