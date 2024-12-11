import { index, pgTable } from 'drizzle-orm/pg-core';

export const core_plugins = pgTable(
  'core_plugins',
  t => ({
    id: t.serial().primaryKey(),
    code: t.varchar({ length: 50 }).notNull().unique(),
    name: t.varchar({ length: 50 }).notNull(),
    description: t.varchar({ length: 255 }),
    version: t.varchar({ length: 255 }).notNull().default('0.0.1'),
    version_code: t.integer().notNull().default(1),
    enabled: t.boolean().notNull().default(true),
    created_at: t.timestamp().notNull().defaultNow(),
    updated_at: t.timestamp().notNull().defaultNow(),
    support_url: t.varchar({ length: 255 }).notNull(),
    author: t.varchar({ length: 100 }).notNull(),
    author_url: t.varchar({ length: 255 }),
    default: t.boolean().notNull().default(false),
    allow_default: t.boolean().notNull().default(true),
  }),
  t => [
    index('core_plugins_code_idx').on(t.code),
    index('core_plugins_name_idx').on(t.name),
  ],
);
