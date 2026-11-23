import { camelCase } from "drizzle-orm/pg-core";

import type { SiteOfflineMessage } from "@/lib/site-status";

import { core_users } from "./users";

/**
 * Whether the public site is open. One row (`id = 1`); a missing row means
 * the site is online.
 */
export const core_site_status = camelCase.table.withRLS(
  "core_site_status",
  t => ({
    id: t.integer().primaryKey().default(1),
    offline: t.boolean().notNull().default(false),
    /** The reason shown to visitors: one rich-text document per language. */
    message: t.jsonb().$type<SiteOfflineMessage>().notNull().default([]),
    /** When the site plans to open. `null` means no countdown. */
    opensAt: t.timestamp({ withTimezone: true }),
    showCountdown: t.boolean().notNull().default(true),
    /** When `offline` last flipped. */
    changedAt: t.timestamp({ withTimezone: true }).notNull().defaultNow(),
    changedById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
);
