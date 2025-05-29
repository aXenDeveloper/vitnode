import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_roles } from './roles';
import { core_sessions_known_devices } from './sessions';
import { core_users } from './users';

export const core_admin_permissions = pgTable(
  'core_admin_permissions',
  t => ({
    id: t.serial().primaryKey(),
    roleId: t.integer().references(() => core_roles.id, {
      onDelete: 'cascade',
    }),
    userId: t.integer().references(() => core_users.id, {
      onDelete: 'cascade',
    }),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
    // data: t.jsonb().$type<{ permissions: PermissionsStaffArgs[] }>().default({
    //   permissions: [],
    // }),
  }),
  t => [
    index('core_admin_permissions_role_id_idx').on(t.roleId),
    index('core_admin_permissions_user_id_idx').on(t.userId),
  ],
).enableRLS();

export const core_admin_permissions_relations = relations(
  core_admin_permissions,
  ({ one }) => ({
    group: one(core_roles, {
      fields: [core_admin_permissions.roleId],
      references: [core_roles.id],
    }),
    user: one(core_users, {
      fields: [core_admin_permissions.userId],
      references: [core_users.id],
    }),
  }),
);

export const core_admin_sessions = pgTable(
  'core_admin_sessions',
  t => ({
    id: t.serial().primaryKey(),
    token: t.varchar({ length: 255 }).notNull().unique(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      }),
    createdAt: t.timestamp().notNull().defaultNow(),
    lastSeen: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
    deviceId: t
      .integer()
      .references(() => core_sessions_known_devices.id, {
        onDelete: 'cascade',
      })
      .notNull(),
  }),
  t => [
    index('core_admin_sessions_token_idx').on(t.token),
    index('core_admin_sessions_user_id_idx').on(t.userId),
  ],
).enableRLS();

export const core_admin_sessions_relations = relations(
  core_admin_sessions,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_admin_sessions.userId],
      references: [core_users.id],
    }),
    device: one(core_sessions_known_devices, {
      fields: [core_admin_sessions.deviceId],
      references: [core_sessions_known_devices.id],
    }),
  }),
);
