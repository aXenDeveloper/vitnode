import { camelCase, index } from "drizzle-orm/pg-core";

import type { PermissionsStaffArgs } from "@/api/lib/permission-staff";

import { core_roles } from "./roles";
import { core_users } from "./users";

export const core_moderators_permissions = camelCase.table.withRLS(
  "core_moderators_permissions",
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
    index("core_moderators_permissions_role_id_idx").on(t.roleId),
    index("core_moderators_permissions_user_id_idx").on(t.userId),
  ],
);
