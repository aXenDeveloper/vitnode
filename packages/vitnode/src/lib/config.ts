/**
 * Fallback used when `CRON_SECRET` is not set. It is intentionally well-known:
 * the admin integrations panel flags cron as insecure while this value is in
 * use so it is obvious a real secret must be provided in production.
 */
export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

/**
 * The origin the page itself was served from, when there is one.
 *
 * VitNode mounts its API on the app's own origin - `https://example.com` serving
 * `https://example.com/api/*` - so in a browser "where is the API" answers
 * itself, without configuration. That matters most exactly where configuration
 * cannot help: a preview deployment's hostname is generated per branch, so no
 * `NEXT_PUBLIC_API_URL` could have named it ahead of time, and the value it
 * would otherwise fall back to names the visitor's own machine.
 *
 * The server half of the same answer is read off the request being handled; see
 * `resolveApiOrigin` in the TanStack Start app.
 *
 * `undefined` wherever there is no document - Node, the API server, a build - so
 * those keep falling through to the configured value.
 */
const browserOrigin = (): string | undefined => {
  if (typeof location === "undefined") return undefined;

  // A sandboxed iframe or a `data:` document reports the string `"null"`, which
  // is not a URL and would throw rather than fall through.
  return location.origin.startsWith("http") ? location.origin : undefined;
};

/**
 * Env is read lazily via getters, not captured at module load. The standalone
 * API loads its `.env` (dotenv) only when `vitnode.api.config.ts` runs, which can
 * be after this module is first imported - reading on access ensures values like
 * `NEXT_PUBLIC_API_URL` are always current instead of frozen to their fallbacks.
 */
export const CONFIG = {
  get api(): URL {
    // `??` rather than `||`, deliberately: an empty `NEXT_PUBLIC_API_URL` is a
    // deployment that got it wrong, and `contentPreviewConfigProblems` reads the
    // throw to say so. Only an absent one falls through.
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ??
        browserOrigin() ??
        "http://localhost:3000",
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
