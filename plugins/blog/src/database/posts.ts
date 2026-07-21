import { core_users } from "@vitnode/core/database/users";
import { pgTable } from "drizzle-orm/pg-core";

import { blog_categories } from "./categories";

export const blog_posts = pgTable("blog_posts", t => ({
  id: t.serial().primaryKey(),
  categoryId: t
    .integer()
    .references(() => blog_categories.id)
    .notNull(),
  authorId: t.integer().references(() => core_users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  createdAt: t.timestamp().notNull().defaultNow(),
  updatedAt: t
    .timestamp()
    .notNull()
    .$onUpdate(() => new Date()),
})).enableRLS();
