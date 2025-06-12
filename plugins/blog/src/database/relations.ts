import { relations } from 'drizzle-orm';

import { blog_categories } from './categories';
import { blog_posts } from './posts';

export const blog_posts_relations = relations(blog_posts, ({ one }) => ({
  category: one(blog_categories, {
    fields: [blog_posts.categoryId],
    references: [blog_categories.id],
  }),
}));

export const blog_categories_relations = relations(
  blog_categories,
  ({ many }) => ({
    posts: many(blog_posts),
  }),
);
