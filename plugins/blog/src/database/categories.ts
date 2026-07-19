import { pgTable } from "drizzle-orm/pg-core";

export const blog_categories = pgTable("blog_categories", t => ({
  id: t.serial().primaryKey(),
  color: t.varchar({ length: 50 }),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
})).enableRLS();
