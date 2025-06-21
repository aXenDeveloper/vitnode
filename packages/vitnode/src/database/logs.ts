import { pgEnum, pgTable } from 'drizzle-orm/pg-core';

import { core_users } from './users';

export const typeLogs = pgEnum('typeLogs', ['info', 'warn', 'error', 'debug']);

export const core_logs = pgTable('core_logs', t => ({
  id: t.serial().primaryKey(),
  pluginCode: t.varchar({ length: 255 }).notNull(),
  type: typeLogs().notNull().default('info'),
  content: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  userId: t.integer().references(() => core_users.id, {
    onDelete: 'set null',
  }),
  ipAddress: t.varchar({ length: 45 }).notNull().default(''),
})).enableRLS();
