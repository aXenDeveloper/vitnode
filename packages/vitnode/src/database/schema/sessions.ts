import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_users } from './users';

export const core_sessions = pgTable(
  'core_sessions',
  t => ({
    token: t.varchar({ length: 255 }).notNull().unique(),
    user_id: t
      .uuid()
      .notNull()
      .references(() => core_users.id, {
        onDelete: 'cascade',
      }),
    created_at: t.timestamp().notNull().defaultNow(),
    expires_at: t.timestamp().notNull(),
    device_id: t
      .uuid()
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
    id: t.uuid().defaultRandom().primaryKey(),
    ip_address: t.varchar({ length: 40 }).notNull(),
    user_agent: t.text().notNull(),
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
  }),
);
