import { pgTable } from "drizzle-orm/pg-core";

import { blog_categories } from "./categories";

export const blog_posts = pgTable("blog_posts", t => ({
  id: t.serial().primaryKey(),
  title: t.varchar({ length: 255 }).notNull(),
  titleSeo: t.varchar({ length: 255 }).notNull().unique(),
  content: t.text().notNull(),
  categoryId: t
    .integer()
    .references(() => blog_categories.id)
    .notNull(),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
})).enableRLS();
