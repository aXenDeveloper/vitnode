import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_admin_sessions } from './admins';
import { core_users } from './users';

export const core_sessions = pgTable(
  'core_sessions',
  t => ({
    login_token: t.varchar({ length: 255 }).primaryKey(),
    user_id: t
      .integer()
      .notNull()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      }),
    created_at: t.timestamp().notNull().defaultNow(),
    expires_at: t.timestamp().notNull(),
    device_id: t
      .integer()
      .references(() => core_sessions_known_devices.id, {
        onDelete: 'cascade',
      })
      .notNull(),
  }),
  t => [index('core_sessions_user_id_idx').on(t.user_id)],
);

export const core_sessions_relations = relations(core_sessions, ({ one }) => ({
  user: one(core_users, {
    fields: [core_sessions.user_id],
    references: [core_users.id],
  }),
  device: one(core_sessions_known_devices, {
    fields: [core_sessions.device_id],
    references: [core_sessions_known_devices.id],
  }),
}));

export const core_sessions_known_devices = pgTable(
  'core_sessions_known_devices',
  t => ({
    id: t.serial().primaryKey(),
    ip_address: t.varchar({ length: 40 }).notNull(),
    user_agent: t.text().notNull(),
    uagent_browser: t.varchar({ length: 200 }).notNull(),
    uagent_version: t.varchar({ length: 100 }).notNull(),
    uagent_os: t.varchar({ length: 100 }).notNull(),
    last_seen: t.timestamp().notNull().defaultNow(),
  }),
  t => [index('core_sessions_known_devices_ip_address_idx').on(t.ip_address)],
);

export const core_sessions_known_devices_relations = relations(
  core_sessions_known_devices,
  ({ one }) => ({
    session: one(core_sessions, {
      fields: [core_sessions_known_devices.id],
      references: [core_sessions.device_id],
    }),
    admin_session: one(core_admin_sessions, {
      fields: [core_sessions_known_devices.id],
      references: [core_admin_sessions.device_id],
    }),
  }),
);
