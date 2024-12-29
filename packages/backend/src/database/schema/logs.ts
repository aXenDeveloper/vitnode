import { pgTable } from 'drizzle-orm/pg-core';

export const core_logs = pgTable('core_logs', t => ({
  id: t.serial().primaryKey(),
  name: t.varchar({ length: 255 }).notNull(),
  message: t.text().notNull(),
  status: t.smallint().notNull(),
  created_at: t.timestamp().notNull().defaultNow(),
  headers: t.jsonb(),
  method: t.varchar({ length: 10 }),
  url: t.varchar({ length: 255 }),
}));

export const core_logs_email = pgTable('core_logs_email', t => ({
  id: t.serial().primaryKey(),
  to: t.varchar({ length: 255 }).notNull(),
  subject: t.varchar({ length: 255 }).notNull(),
  created_at: t.timestamp().notNull().defaultNow(),
  error: t.text().notNull(),
  html: t.text().notNull(),
}));
