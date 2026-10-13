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

/**
 * Every container of every definition, as an adjacency list.
 *
 * One table rather than one per definition: a definition is code, not schema,
 * so adding a forum's boards needs no migration, and a content type's
 * `field.container()` always points at the same column. The definition's own
 * fields live in `metadata`, validated against the definition on every write.
 */
export const core_content_containers = camelCase.table.withRLS(
  "core_content_containers",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 255 }).notNull(),
    definitionId: t.varchar({ length: 100 }).notNull(),
    // RESTRICT, so a parent with children cannot disappear underneath them -
    // the service refuses first with a readable error, and the constraint is
    // what makes that true under a concurrent writer too.
    parentId: t
      .integer()
      .references((): AnyPgColumn => core_content_containers.id, {
        onDelete: "restrict",
      }),
    name: t.varchar({ length: CONTENT_CONTAINER_NAME_MAX_LENGTH }).notNull(),
    slug: t.varchar({ length: CONTENT_CONTAINER_SLUG_MAX_LENGTH }).notNull(),
    position: t.integer().notNull().default(0),
    metadata: t.jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    // A slug addresses one container of one definition: `/forums/frontend`.
    uniqueIndex("core_content_containers_definition_slug_key").on(
      t.definitionId,
      t.slug,
    ),
    // The tree read: every container of a definition, in sibling order.
    index("core_content_containers_definition_parent_position_idx").on(
      t.definitionId,
      t.parentId,
      t.position,
    ),
    index("core_content_containers_parent_idx").on(t.parentId),
  ],
);
