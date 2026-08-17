import { camelCase, index } from "drizzle-orm/pg-core";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_roles } from "./roles";
import { core_sessions_known_devices } from "./sessions";
import { core_users } from "./users";

export const core_admin_permissions = camelCase.table.withRLS(
  "core_admin_permissions",
  t => ({
    id: t.serial().primaryKey(),
    roleId: t.integer().references(() => core_roles.id, {
      onDelete: "cascade",
    }),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "cascade",
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
    unrestricted: t.boolean().notNull().default(false),
    permissions: t
      .jsonb()
      .$type<PermissionsStaffArgs[]>()
      .notNull()
      .default([]),
  }),
  t => [
    index("core_admin_permissions_role_id_idx").on(t.roleId),
    index("core_admin_permissions_user_id_idx").on(t.userId),
  ],
);

export const core_admin_sessions = camelCase.table.withRLS(
  "core_admin_sessions",
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
    lastSeen: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
    deviceId: t
      .integer()
      .references(() => core_sessions_known_devices.id, {
        onDelete: "cascade",
      })
      .notNull(),
  }),
  t => [
    index("core_admin_sessions_token_idx").on(t.token),
    index("core_admin_sessions_user_id_idx").on(t.userId),
  ],
);
