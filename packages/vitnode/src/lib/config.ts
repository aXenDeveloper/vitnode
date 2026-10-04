export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

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

export const CONFIG = {
  get api(): URL {
    // `??` rather than `||`, deliberately: an empty `VITNODE_API_URL` is a
    // deployment that got it wrong, and `contentPreviewConfigProblems` reads the
    // throw to say so. Only an absent one falls through.
    return new URL(
      process.env.VITNODE_API_URL ?? browserOrigin() ?? "http://localhost:3000",
    );
  },
  get cronJobSecret(): string {
    return process.env.CRON_SECRET ?? INSECURE_DEFAULT_CRON_SECRET;
  },
  get node_development(): boolean {
    return process.env.NODE_ENV === "development";
  },
  get trustedProxyHops(): number {
    const hops = Number(process.env.VITNODE_TRUSTED_PROXY_HOPS ?? 0);

    return Number.isSafeInteger(hops) && hops > 0 ? hops : 0;
  },
  get web(): URL {
    return new URL(process.env.VITNODE_WEB_URL ?? "http://localhost:3000");
  },
};
