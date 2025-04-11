import { relations } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';

import { core_roles } from './roles';
import { core_users } from './users';

export const core_moderators_permissions = pgTable(
  'core_moderators_permissions',
  t => ({
    id: t.uuid().defaultRandom().primaryKey(),
    role_id: t.uuid().references(() => core_roles.id, {
      onDelete: 'cascade',
    }),
    user_id: t.uuid().references(() => core_users.id, {
      onDelete: 'cascade',
    }),
    created_at: t.timestamp().notNull().defaultNow(),
    updated_at: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
  }),
  t => [
    index('core_moderators_permissions_role_id_idx').on(t.role_id),
    index('core_moderators_permissions_user_id_idx').on(t.user_id),
  ],
);

export const core_moderators_permissions_relations = relations(
  core_moderators_permissions,
  ({ one }) => ({
    group: one(core_roles, {
      fields: [core_moderators_permissions.role_id],
      references: [core_roles.id],
    }),
    user: one(core_users, {
      fields: [core_moderators_permissions.user_id],
      references: [core_users.id],
    }),
  }),
);
