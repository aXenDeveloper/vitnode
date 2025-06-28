import { pgEnum, pgTable } from 'drizzle-orm/pg-core';

import { core_users } from './users';

export const coreLogsType = pgEnum('coreLogsType', ['warn', 'error', 'debug']);

export type CoreLogsType = (typeof coreLogsType.enumValues)[number];

export const core_logs = pgTable('core_logs', t => ({
  id: t.serial().primaryKey(),
  pluginId: t.varchar({ length: 255 }).notNull(),
  type: coreLogsType().notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  ipAddress: t.varchar({ length: 45 }).notNull(),
  method: t.varchar({ length: 10 }).notNull().default('GET'),
  path: t.text().notNull().default('localhost'),
  userAgent: t.text(),
  statusCode: t.integer().notNull().default(500),
  userId: t.bigint({ mode: 'number' }).references(() => core_users.id, {
    onDelete: 'set null',
    onUpdate: 'cascade',
  }),
})).enableRLS();
