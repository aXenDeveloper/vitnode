const ENVS = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  webUrl: process.env.NEXT_PUBLIC_WEB_URL,
  cronConfig:
    process.env.CRON_SECRET ?? "default-cron-secret-change-in-production",
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
