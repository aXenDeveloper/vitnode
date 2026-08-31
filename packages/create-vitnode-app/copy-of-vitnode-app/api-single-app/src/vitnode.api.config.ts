import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { coreRelations } from "@vitnode/core/database/relations";
import { drizzle } from "drizzle-orm/postgres-js";

import { i18n } from "./i18n";

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  metadata: {
    title: "VitNode",
    shortTitle: "VitNode",
  },
  plugins: [],
  /**
   * The same `src/i18n.ts` the frontend config reads, because this app is both:
   * one declaration of which languages exist, spread into `buildConfig` through
   * `vitnode.shell.config.ts` and passed here.
   *
   * It is also what `vitnode db:prepare` seeds `core_languages` from - this app
   * owns the schema - so adding a language here and re-running `dev` inserts its
   * row. Leave it out and the seed falls back to `en` alone, whatever the site
   * serves.
   */
  i18n,
  dbProvider: drizzle({
    connection: POSTGRES_URL,
    relations: coreRelations,
  }),
  // Redis is opt-in: only enabled when REDIS_URL is set. Without it the cache
  // is a no-op, the rate limiter uses in-memory storage, and WebSockets run in
  // single-instance mode.
  redis: process.env.REDIS_URL
    ? { url: process.env.REDIS_URL, password: process.env.REDIS_PASSWORD }
    : undefined,
});
