import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_users } from './users';

export const core_sessions = pgTable(
  'core_sessions',
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
    expiresAt: t.timestamp().notNull(),
    deviceId: t
      .integer()
      .references(() => core_sessions_known_devices.id, {
        onDelete: 'cascade',
      })
      .notNull(),
  }),
  t => [index('core_sessions_user_id_idx').on(t.userId)],
).enableRLS();

export const core_sessions_relations = relations(core_sessions, ({ one }) => ({
  user: one(core_users, {
    fields: [core_sessions.userId],
    references: [core_users.id],
  }),
  device: one(core_sessions_known_devices, {
    fields: [core_sessions.deviceId],
    references: [core_sessions_known_devices.id],
  }),
}));

export const core_sessions_known_devices = pgTable(
  'core_sessions_known_devices',
  t => ({
    id: t.serial().primaryKey(),
    ipAddress: t.varchar({ length: 40 }).notNull(),
    userAgent: t.text().notNull(),
    lastSeen: t.timestamp().notNull().defaultNow(),
  }),
  t => [index('core_sessions_known_devices_ip_address_idx').on(t.ipAddress)],
).enableRLS();

export const core_sessions_known_devices_relations = relations(
  core_sessions_known_devices,
  ({ one }) => ({
    session: one(core_sessions, {
      fields: [core_sessions_known_devices.id],
      references: [core_sessions.deviceId],
    }),
  }),
);
