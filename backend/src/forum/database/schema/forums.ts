import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { core_groups } from '@/src/core/database/schema/groups';
import { core_languages } from '@/src/core/database/schema/languages';

export const forum_forums = pgTable('forum_forums', {
  id: uuid('id').defaultRandom().primaryKey(),
  created: integer('created').notNull(),
  parent_id: uuid('parent_id').references(() => forum_forums.id, {
    onDelete: 'cascade'
  }),
  position: integer('position').notNull().default(0),
  can_all_view: boolean('can_all_view').notNull().default(false),
  can_all_read: boolean('can_all_read').notNull().default(false),
  can_all_create: boolean('can_all_create').notNull().default(false),
  can_all_reply: boolean('can_all_reply').notNull().default(false)
});

export const relations_forum_forums = relations(forum_forums, ({ many, one }) => ({
  parent: one(forum_forums, {
    fields: [forum_forums.parent_id],
    references: [forum_forums.id]
  }),
  name: many(forum_forums_name),
  description: many(forum_forums_description),
  permissions: many(forum_forums_permissions)
}));

export const forum_forums_name = pgTable('forum_forums_name', {
  forum_id: uuid('forum_id')
    .notNull()
    .references(() => forum_forums.id, {
      onDelete: 'cascade'
    }),
  id_language: varchar('id_language')
    .notNull()
    .references(() => core_languages.id, {
      onDelete: 'cascade'
    }),
  value: varchar('value').notNull()
});

export const forum_forums_description = pgTable('forum_forums_description', {
  forum_id: uuid('forum_id')
    .notNull()
    .references(() => forum_forums.id, {
      onDelete: 'cascade'
    }),
  id_language: varchar('id_language')
    .notNull()
    .references(() => core_languages.id, {
      onDelete: 'cascade'
    }),
  value: varchar('value').notNull()
});

export const forum_forums_permissions = pgTable('forum_forums_permissions', {
  forum_id: uuid('forum_id').references(() => forum_forums.id, {
    onDelete: 'cascade'
  }),
  group_id: uuid('group_id').references(() => core_groups.id, {
    onDelete: 'cascade'
  }),
  can_view: boolean('can_view').notNull().default(false),
  can_read: boolean('can_read').notNull().default(false),
  can_create: boolean('can_create').notNull().default(false),
  can_reply: boolean('can_reply').notNull().default(false)
});