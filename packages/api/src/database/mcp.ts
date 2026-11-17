import { camelCase, index } from "drizzle-orm/pg-core";

import { core_users } from "./users";

/**
 * MCP bearer tokens. Only the SHA-256 of a token is stored; the token itself
 * is shown once, when it is created. Deleting the owner deletes the tokens.
 */
export const core_mcp_tokens = camelCase.table.withRLS(
  "core_mcp_tokens",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    label: t.varchar({ length: 100 }).notNull(),
    /** The token's first characters, to tell tokens apart in a list. */
    prefix: t.varchar({ length: 32 }).notNull(),
    tokenHash: t.varchar({ length: 64 }).notNull().unique(),
    /** Full tool names (`vitnode-blog__blog_post_list`) the token may call. */
    tools: t.jsonb().$type<string[]>().notNull(),
    expiresAt: t.timestamp().notNull(),
    revokedAt: t.timestamp(),
    lastUsedAt: t.timestamp(),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_mcp_tokens_user_id_idx").on(t.userId)],
);
