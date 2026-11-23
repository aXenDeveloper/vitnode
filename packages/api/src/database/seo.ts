import { camelCase } from "drizzle-orm/pg-core";

import { core_users } from "./users";

/**
 * Crawling and indexing settings: `robots.txt` and XML sitemaps. One row
 * (`id = 1`); a missing row means the defaults (indexing on, sitemaps on).
 */
export const core_seo_settings = camelCase.table.withRLS(
  "core_seo_settings",
  t => ({
    id: t.integer().primaryKey().default(1),
    allowIndexing: t.boolean().notNull().default(true),
    blockAiCrawlers: t.boolean().notNull().default(false),
    /** Extra `robots.txt` lines appended as written. */
    customRobots: t.text().notNull().default(""),
    sitemapEnabled: t.boolean().notNull().default(true),
    sitemapMaxUrls: t.integer().notNull().default(10_000),
    /**
     * Sitemap source ids an admin switched off. Stored as the disabled set, so a
     * source a plugin adds later is listed until somebody turns it off.
     */
    disabledSitemapSources: t.jsonb().$type<string[]>().notNull().default([]),
    updatedById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);
