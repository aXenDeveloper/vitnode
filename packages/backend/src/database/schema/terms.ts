import { pgTable } from 'drizzle-orm/pg-core';

export const core_terms = pgTable('core_terms', t => ({
  id: t.serial().primaryKey(),
  code: t.varchar().notNull().unique(),
  created_at: t.timestamp().notNull().defaultNow(),
  updated_at: t.timestamp().notNull().defaultNow(),
  href: t.varchar(),
}));
