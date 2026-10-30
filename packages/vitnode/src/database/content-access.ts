import { camelCase, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";

import { core_roles } from "./roles";

/**
 * One access rule an administrator set on one scope: a container, a blog
 * category, or any other scope a plugin declares. A scope with no row for an
 * action inherits it. `family` is the container collection or content type
 * id, `scopeId` the scope's own id as text.
 */
export const core_content_access_rules = camelCase.table.withRLS(
  "core_content_access_rules",
  t => ({
    id: t.serial().primaryKey(),
    family: t.varchar({ length: 100 }).notNull(),
    scopeId: t.varchar({ length: 64 }).notNull(),
    action: t.varchar({ length: 32 }).notNull(),
    mode: t.varchar({ length: 16 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [
    uniqueIndex("core_content_access_rules_scope_action_key").on(
      t.family,
      t.scopeId,
      t.action,
    ),
  ],
);

/**
 * The roles a `roles` rule lets in. Deleting a role deletes its rows, and a
 * `roles` rule with no row left lets nobody in - a deleted role never opens a
 * restricted scope.
 */
export const core_content_access_rule_roles = camelCase.table.withRLS(
  "core_content_access_rule_roles",
  t => ({
    ruleId: t
      .integer()
      .notNull()
      .references(() => core_content_access_rules.id, {
        onDelete: "cascade",
      }),
    roleId: t
      .integer()
      .notNull()
      .references(() => core_roles.id, { onDelete: "cascade" }),
  }),
  t => [
    primaryKey({ columns: [t.ruleId, t.roleId] }),
    index("core_content_access_rule_roles_role_id_idx").on(t.roleId),
  ],
);
