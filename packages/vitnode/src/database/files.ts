import { camelCase, index } from "drizzle-orm/pg-core";

import { core_users } from "./users";

export const core_files = camelCase.table.withRLS(
  "core_files",
  t => ({
    id: t.serial().primaryKey(),
    name: t.varchar({ length: 255 }).notNull(),
    key: t.varchar({ length: 512 }).notNull().unique(),
    folder: t.varchar({ length: 255 }).notNull(),
    mimeType: t.varchar({ length: 255 }),
    size: t.integer().notNull().default(0),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "set null",
    }),
    pluginId: t.varchar({ length: 100 }),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [index("core_files_user_id_idx").on(t.userId)],
);
