import { relations } from "drizzle-orm";
import { index, pgTable } from "drizzle-orm/pg-core";

import { core_roles } from "./roles";
import { core_users } from "./users";

export const core_moderators_permissions = pgTable(
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
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
  }),
  t => [
    index("core_moderators_permissions_role_id_idx").on(t.roleId),
    index("core_moderators_permissions_user_id_idx").on(t.userId),
  ],
).enableRLS();

export const core_moderators_permissions_relations = relations(
  core_moderators_permissions,
  ({ one }) => ({
    group: one(core_roles, {
      fields: [core_moderators_permissions.roleId],
      references: [core_roles.id],
    }),
    user: one(core_users, {
      fields: [core_moderators_permissions.userId],
      references: [core_users.id],
    }),
  }),
);
