import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_groups } from './groups';
import { core_sessions_known_devices } from './sessions';
import { core_users } from './users';

export const core_admin_permissions = pgTable(
  'core_admin_permissions',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    group_id: t.uuid().references(() => core_groups.id, {
      onDelete: 'cascade',
    }),
    user_id: t.uuid().references(() => core_users.id, {
      onDelete: 'cascade',
    }),
    created_at: t.timestamp().notNull().defaultNow(),
    updated_at: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
    // data: t.jsonb().$type<{ permissions: PermissionsStaffArgs[] }>().default({
    //   permissions: [],
    // }),
  }),
  t => [
    index('core_admin_permissions_group_id_idx').on(t.group_id),
    index('core_admin_permissions_user_id_idx').on(t.user_id),
  ],
);

export const core_admin_permissions_relations = relations(
  core_admin_permissions,
  ({ one }) => ({
    group: one(core_groups, {
      fields: [core_admin_permissions.group_id],
      references: [core_groups.id],
    }),
    user: one(core_users, {
      fields: [core_admin_permissions.user_id],
      references: [core_users.id],
    }),
  }),
);

export const core_admin_sessions = pgTable(
  'core_admin_sessions',
  t => ({
    token: t.varchar({ length: 255 }).primaryKey(),
    user_id: t
      .uuid()
      .notNull()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      }),
    created_at: t.timestamp().notNull().defaultNow(),
    last_seen: t.timestamp().notNull().defaultNow(),
    expires_at: t.timestamp().notNull(),
    device_id: t
      .uuid()
      .references(() => core_sessions_known_devices.id, {
        onDelete: 'cascade',
      })
      .notNull(),
  }),
  t => [
    index('core_admin_sessions_token_idx').on(t.token),
    index('core_admin_sessions_user_id_idx').on(t.user_id),
  ],
);

export const core_admin_sessions_relations = relations(
  core_admin_sessions,
  ({ one }) => ({
    user: one(core_users, {
      fields: [core_admin_sessions.user_id],
      references: [core_users.id],
    }),
    device: one(core_sessions_known_devices, {
      fields: [core_admin_sessions.device_id],
      references: [core_sessions_known_devices.id],
    }),
  }),
);
