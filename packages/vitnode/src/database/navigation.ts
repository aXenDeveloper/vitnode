import { type AnyPgColumn, camelCase, index } from "drizzle-orm/pg-core";

export const core_navigation = camelCase.table.withRLS(
  "core_navigation",
  t => ({
    id: t.serial().primaryKey(),
    parentId: t.integer().references((): AnyPgColumn => core_navigation.id, {
      onDelete: "set null",
    }),
    kind: t.varchar({ length: 16 }).notNull(),
    pluginId: t.varchar({ length: 50 }),
    presetId: t.varchar({ length: 120 }),
    href: t.text(),
    icon: t.varchar({ length: 64 }),
    isOpenInNewTab: t.boolean().notNull().default(false),
    position: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    index("core_navigation_position_idx").on(t.position),
    index("core_navigation_parent_idx").on(t.parentId),
  ],
);
