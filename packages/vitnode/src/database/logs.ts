import { camelCase, index } from "drizzle-orm/pg-core";

import { core_users } from "./users";

export const core_logs = camelCase.table.withRLS(
  "core_logs",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    type: t.varchar({ enum: ["warn", "error", "debug"], length: 10 }).notNull(),
    content: t.text().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    ipAddress: t.varchar({ length: 45 }).notNull(),
    method: t.varchar({ length: 10 }).notNull().default("GET"),
    path: t.text().notNull().default("localhost"),
    userAgent: t.text(),
    statusCode: t.integer().notNull().default(500),
    userId: t.bigint({ mode: "number" }).references(() => core_users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    test123: t.boolean().notNull().default(false),
  }),
  t => [index("core_logs_created_at_id_idx").on(t.createdAt, t.id)],
);
