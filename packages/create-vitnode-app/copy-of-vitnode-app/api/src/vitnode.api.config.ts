import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { config } from "dotenv";
import { coreRelations } from "@vitnode/core/database/relations";
import { drizzle } from "drizzle-orm/postgres-js";

import { i18n } from "./i18n.js";

config({
  quiet: true,
});

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  /**
   * The installation's languages - see `src/i18n.ts`, and keep it in step with
   * the web app's file of the same name.
   *
   * This app owns the schema, so `vitnode db:prepare` seeds `core_languages`
   * from this list. Leave it out and the seed falls back to `en` alone, whatever
   * the site serves.
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
  metadata: {
    title: "VitNode API",
    shortTitle: "VitNode",
  },
});
