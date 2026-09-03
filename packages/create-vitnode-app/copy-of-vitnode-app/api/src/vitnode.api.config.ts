import { buildApiConfig } from "@vitnode/core/vitnode.config";
import { config } from "dotenv";
import { coreRelations } from "@vitnode/core/database/relations";
import { drizzle } from "drizzle-orm/postgres-js";

config({
  quiet: true,
});

export const POSTGRES_URL =
  process.env.POSTGRES_URL ?? "postgresql://root:root@localhost:5432/vitnode";

export const vitNodeApiConfig = buildApiConfig({
  plugins: [],
  /**
   * The languages this installation serves.
   *
   * The API half of a split deployment. `apps/web/src/vitnode.config.ts`
   * declares the same list, and the two are one declaration in two places by
   * necessity rather than by design: they are separate packages, so neither can
   * import the other's. Nothing walks the filesystem looking for the web app's
   * config either - a bootstrap that guessed at a sibling application is exactly
   * what that replaced, and it guessed wrong the moment the two were not laid
   * out the way it expected.
   *
   * They have to agree, and this is the copy that matters most: this app owns
   * the schema, so `vitnode db:prepare` seeds `core_languages` from *this* list.
   * A language that is here and not in the web app's renders nowhere; one that
   * is in the web app's and not here has no row in the database.
   *
   * Packages ship their own translations, so a new locale needs no `messages`
   * entry - anything untranslated falls back to `defaultLocale` key by key.
   */
  i18n: {
    defaultLocale: "en",
    locales: [{ code: "en", name: "English" }],
    /**
     * Explicit, because this API renders emails on a server: without one, dates
     * format in whatever zone the host happens to run in.
     */
    timeZone: "UTC",
  },
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
