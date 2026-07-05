/**
 * Fallback used when `CRON_SECRET` is not set. It is intentionally well-known:
 * the admin integrations panel flags cron as insecure while this value is in
 * use so it is obvious a real secret must be provided in production.
 */
export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

/**
 * Env is read lazily via getters, not captured at module load. The standalone
 * API loads its `.env` (dotenv) only when `vitnode.api.config.ts` runs, which can
 * be after this module is first imported — reading on access ensures values like
 * `NEXT_PUBLIC_API_URL` are always current instead of frozen to their fallbacks.
 */
export const CONFIG = {
  get api(): URL {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000");
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
