/**
 * Fallback used when `CRON_SECRET` is not set. It is intentionally well-known:
 * the admin integrations panel flags cron as insecure while this value is in
 * use so it is obvious a real secret must be provided in production.
 */
export const INSECURE_DEFAULT_CRON_SECRET =
  "default-cron-secret-change-in-production";

const ENVS = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  webUrl: process.env.NEXT_PUBLIC_WEB_URL,
  cronConfig: process.env.CRON_SECRET ?? INSECURE_DEFAULT_CRON_SECRET,
};

const urls = {
  api: new URL(ENVS.apiUrl ?? "http://localhost:3000"),
  web: new URL(ENVS.webUrl ?? "http://localhost:3000"),
};

export const CONFIG = {
  node_development: process.env.NODE_ENV === "development",
  ...urls,
  cronJobSecret: ENVS.cronConfig,
};
