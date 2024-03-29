import {
  integer,
  pgTable,
  serial,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

import { blog_articles } from "./articles";

import { core_languages } from "@/plugins/core/admin/database/schema/languages";

export const blog_categories = pgTable("blog_categories", {
  id: serial("id").primaryKey(),
  created: timestamp("created").notNull().defaultNow(),
  position: integer("position").notNull().default(0)
});

export const blog_categories_relations = relations(
  blog_categories,
  ({ many }) => ({
    articles: many(blog_articles),
    title: many(blog_categories_title),
    description: many(blog_categories_description)
  })
);

export const blog_categories_title = pgTable("blog_categories_title", {
  id: serial("id").primaryKey(),
  category_id: serial("category_id").references(() => blog_categories.id, {
    onDelete: "cascade"
  }),
  language_code: varchar("language_code")
    .notNull()
    .references(() => core_languages.code, {
      onDelete: "cascade"
    }),
  value: varchar("value", { length: 50 }).notNull()
});

export const blog_categories_title_relations = relations(
  blog_categories_title,
  ({ one }) => ({
    category: one(blog_categories, {
      fields: [blog_categories_title.category_id],
      references: [blog_categories.id]
    })
  })
);

export const blog_categories_description = pgTable(
  "blog_categories_description",
  {
    id: serial("id").primaryKey(),
    category_id: serial("category_id").references(() => blog_categories.id, {
      onDelete: "cascade"
    }),
    language_code: varchar("language_code")
      .notNull()
      .references(() => core_languages.code, {
        onDelete: "cascade"
      }),
    value: varchar("value", { length: 150 }).notNull()
  }
);

export const blog_categories_description_relations = relations(
  blog_categories_description,
  ({ one }) => ({
    category: one(blog_categories, {
      fields: [blog_categories_description.category_id],
      references: [blog_categories.id]
    })
  })
);
