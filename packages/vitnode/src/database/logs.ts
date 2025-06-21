import { pgEnum, pgTable } from 'drizzle-orm/pg-core';

export const coreLogsType = pgEnum('coreLogsType', [
  'info',
  'warn',
  'error',
  'debug',
]);

export type CoreLogsType = (typeof coreLogsType.enumValues)[number];

export const core_logs = pgTable('core_logs', t => ({
  id: t.serial().primaryKey(),
  pluginId: t.varchar({ length: 255 }).notNull(),
  type: coreLogsType().notNull().default('info'),
  content: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  ipAddress: t.varchar({ length: 45 }).notNull(),
})).enableRLS();
