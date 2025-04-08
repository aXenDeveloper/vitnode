import { pgTable } from 'drizzle-orm/pg-core';

export const core_groups = pgTable('core_groups', t => ({
  id: t.uuid().defaultRandom().primaryKey(),
  created_at: t.timestamp().notNull().defaultNow(),
  updated_at: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
  protected: t.boolean().notNull().default(false),
  default: t.boolean().notNull().default(false),
  root: t.boolean().notNull().default(false),
  guest: t.boolean().notNull().default(false),
  color: t.varchar({ length: 19 }),
  files_allow_upload: t.boolean().notNull().default(true),
  files_total_max_storage: t.integer().notNull().default(500000),
  files_max_storage_for_submit: t.integer().notNull().default(5000),
}));
