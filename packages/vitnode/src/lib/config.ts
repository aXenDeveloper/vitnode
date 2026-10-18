/** The `CRON_SECRET` used when none is set. Refused outside development. */
export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

/** Placeholder values `CRON_SECRET` must not keep in production. */
export const INSECURE_CRON_SECRETS: readonly string[] = [
  INSECURE_DEFAULT_CRON_SECRET,
  "your-secure-cron-secret-key",
  "changeme",
  "secret",
];

const browserOrigin = (): string | undefined => {
  if (typeof location === "undefined") return undefined;

  // A sandboxed iframe or a `data:` document reports the string `"null"`, which
  // is not a URL and would throw rather than fall through.
  return location.origin.startsWith("http") ? location.origin : undefined;
};

/**
 * Deployment settings read from environment variables. Each getter reads
 * `process.env` on every access, so values set after import still apply.
 * Universal: in the browser only `VITNODE_API_URL`, `VITNODE_WEB_URL` and any
 * `clientEnv` keys (defined by the VitNode Vite plugin), plus `NODE_ENV`
 * (replaced by Vite), are defined.
 */
export const CONFIG = {
  /**
   * The API's origin: `VITNODE_API_URL`, else the page's own origin in the
   * browser, else `http://localhost:3000`.
   *
   * @throws When `VITNODE_API_URL` is set but not a valid URL - an empty value
   * included.
   */
  get api(): URL {
    // `??` rather than `||`, deliberately: an empty `VITNODE_API_URL` is a
    // deployment that got it wrong, and `contentPreviewConfigProblems` reads the
    // throw to say so. Only an absent one falls through.
    return new URL(
      process.env.VITNODE_API_URL ?? browserOrigin() ?? "http://localhost:3000",
    );
  },
  /** `CRON_SECRET`, authenticating cron and revalidation calls. Falls back to an insecure default. */
  get cronJobSecret(): string {
    return process.env.CRON_SECRET ?? INSECURE_DEFAULT_CRON_SECRET;
  },
  /** Whether `NODE_ENV` is `development`. */
  get node_development(): boolean {
    return process.env.NODE_ENV === "development";
  },
  /**
   * `VITNODE_TRUSTED_PROXY_HOPS`: how many reverse proxies in front of the app
   * may be trusted in `x-forwarded-for`. Defaults to `0` (trust none); an
   * invalid value also counts as `0`.
   */
  get trustedProxyHops(): number {
    const hops = Number(process.env.VITNODE_TRUSTED_PROXY_HOPS ?? 0);

    return Number.isSafeInteger(hops) && hops > 0 ? hops : 0;
  },
  /**
   * The web app's origin, `VITNODE_WEB_URL`, defaulting to
   * `http://localhost:3000`. The API's default CORS and CSRF origin, and the
   * default passkey origin.
   */
  get web(): URL {
    return new URL(process.env.VITNODE_WEB_URL ?? "http://localhost:3000");
  },
};

/** Whether a cron secret must be refused: empty, or a placeholder outside development. */
export const isCronSecretRejected = (secret: string | undefined): boolean =>
  !secret ||
  (INSECURE_CRON_SECRETS.includes(secret) && !CONFIG.node_development);
