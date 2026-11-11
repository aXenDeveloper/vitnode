import { core_users } from "@vitnode/core/database/users";
import { camelCase, index } from "drizzle-orm/pg-core";

import { newsroom_articles } from "./articles";

/**
 * A correction notice on an article, filed by an editor. `body` is public;
 * who filed it (`createdById`) stays in the AdminCP.
 */
export const newsroom_corrections = camelCase.table.withRLS(
  "newsroom_corrections",
  t => ({
    id: t.serial().primaryKey(),
    articleId: t
      .integer()
      .notNull()
      .references(() => newsroom_articles.id, { onDelete: "cascade" }),
    body: t.varchar({ length: 1000 }).notNull(),
    createdById: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("newsroom_corrections_article_id_idx").on(t.articleId)],
);
