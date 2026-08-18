import { camelCase, index } from "drizzle-orm/pg-core";

import { core_users } from "./users";

export const core_sessions = camelCase.table.withRLS(
  "core_sessions",
  t => ({
    id: t.serial().primaryKey(),
    token: t.varchar({ length: 255 }).notNull().unique(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, {
        onDelete: "cascade",
      }),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
    deviceId: t
      .integer()
      .references(() => core_sessions_known_devices.id, {
        onDelete: "cascade",
      })
      .notNull(),
  }),
  t => [index("core_sessions_user_id_idx").on(t.userId)],
);

export const core_sessions_known_devices = camelCase.table.withRLS(
  "core_sessions_known_devices",
  t => ({
    id: t.serial().primaryKey(),
    publicId: t.varchar({ length: 32 }).notNull().unique(),
    ipAddress: t.varchar({ length: 40 }).notNull(),
    userAgent: t.text().notNull(),
    lastSeen: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_sessions_known_devices_ip_address_idx").on(t.ipAddress)],
);
