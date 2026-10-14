import {
  type AnyPgColumn,
  camelCase,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  CONTENT_CONTAINER_NAME_MAX_LENGTH,
  CONTENT_CONTAINER_SLUG_MAX_LENGTH,
} from "../content/containers/const";

export const core_content_containers = camelCase.table.withRLS(
  "core_content_containers",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    definitionId: t.varchar({ length: 100 }).notNull(),
    parentId: t
      .integer()
      .references((): AnyPgColumn => core_content_containers.id, {
        onDelete: "restrict",
      }),
    name: t.varchar({ length: CONTENT_CONTAINER_NAME_MAX_LENGTH }).notNull(),
    slug: t.varchar({ length: CONTENT_CONTAINER_SLUG_MAX_LENGTH }).notNull(),
    position: t.integer().notNull().default(0),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    policies: t
      .jsonb()
      .$type<Record<string, Record<string, unknown>>>()
      .notNull()
      .default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_content_containers_definition_slug_key").on(
      t.definitionId,
      t.slug,
    ),
    index("core_content_containers_definition_parent_position_idx").on(
      t.definitionId,
      t.parentId,
      t.position,
    ),
    index("core_content_containers_parent_idx").on(t.parentId),
  ],
);
