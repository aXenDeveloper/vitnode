import { pgTable } from 'drizzle-orm/pg-core';

export const blog_categories = pgTable('blog_categories', t => ({
  id: t.serial().primaryKey(),
  title: t.text().notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
})).enableRLS();
