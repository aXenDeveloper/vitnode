import { pgTable } from 'drizzle-orm/pg-core';

export const core_test = pgTable('core_test', t => ({
  id: t.serial().primaryKey(),
  createdAt: t.timestamp().notNull().defaultNow(),
  text: t.text().notNull(),
})).enableRLS();
