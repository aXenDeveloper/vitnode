import {
  camelCase,
  index,
  pgSequence,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";

import type { ReactionKind } from "@/lib/reactions/const";

import { CONTENT_ID_KEY_LENGTH } from "../content/const";
import { REACTION_KINDS } from "../lib/reactions/const";
import { core_files } from "./files";
import { core_roles } from "./roles";
import { core_users } from "./users";

/**
 * The reactions admins manage in the AdminCP. Titles live in
 * `core_languages_words` (`tableName: "core_reactions"`, `variable: "title"`).
 */
export const core_reactions = camelCase.table.withRLS(
  "core_reactions",
  t => ({
    id: t.serial().primaryKey(),
    code: t.varchar({ length: 32 }).notNull().unique(),
    kind: t
      .varchar({ enum: REACTION_KINDS, length: 10 })
      .$type<ReactionKind>()
      .notNull(),
    // `emoji:👍` or `icon:heart` (the EmojiIconPicker format); null for `image`.
    icon: t.varchar({ length: 100 }),
    fileId: t
      .integer()
      .references(() => core_files.id, { onDelete: "restrict" }),
    // The first frame of an animated upload, shown with reduced motion.
    posterFileId: t
      .integer()
      .references(() => core_files.id, { onDelete: "set null" }),
    points: t.integer().notNull().default(0),
    allRoles: t.boolean().notNull().default(true),
    enabled: t.boolean().notNull().default(true),
    position: t.integer().notNull().default(0),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  }),
  t => [index("core_reactions_position_idx").on(t.position, t.id)],
);

/**
 * A role's access to one reaction and its daily limit (`null` = unlimited).
 * With `allRoles = false` only these roles may use the reaction; with
 * `allRoles = true` every role may, and a row only sets that role's limit.
 */
export const core_reactions_roles = camelCase.table.withRLS(
  "core_reactions_roles",
  t => ({
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    roleId: t
      .integer()
      .notNull()
      .references(() => core_roles.id, { onDelete: "cascade" }),
    dailyLimit: t.integer(),
  }),
  t => [
    primaryKey({ columns: [t.reactionId, t.roleId] }),
    index("core_reactions_roles_role_id_idx").on(t.roleId),
  ],
);

/** One user's reaction to one target. */
export const core_reactions_entries = camelCase.table.withRLS(
  "core_reactions_entries",
  t => ({
    id: t.serial().primaryKey(),
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    // Who collects the points: null for self reactions and targets with
    // `reputation: false`.
    targetAuthorId: t
      .integer()
      .references(() => core_users.id, { onDelete: "set null" }),
    createdAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    unique("core_reactions_entries_unique").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.userId,
      t.reactionId,
    ),
    index("core_reactions_entries_user_timeline_idx").on(
      t.userId,
      t.createdAt,
      t.id,
    ),
    index("core_reactions_entries_user_reaction_idx").on(
      t.userId,
      t.reactionId,
      t.createdAt,
    ),
    index("core_reactions_entries_target_idx").on(
      t.pluginId,
      t.targetType,
      t.targetId,
      t.reactionId,
      t.createdAt,
    ),
    index("core_reactions_entries_author_idx").on(
      t.targetAuthorId,
      t.reactionId,
    ),
    index("core_reactions_entries_reaction_idx").on(t.reactionId),
  ],
);

/** Stamps every count write; writes to one target are serialized, so it follows commit order. */
export const core_reactions_counts_version_seq = pgSequence(
  "core_reactions_counts_version_seq",
);

/** Denormalized counts, written in the same transaction as the entry. */
export const core_reactions_counts = camelCase.table.withRLS(
  "core_reactions_counts",
  t => ({
    pluginId: t.varchar({ length: 100 }).notNull(),
    targetType: t.varchar({ length: 100 }).notNull(),
    targetId: t.varchar({ length: CONTENT_ID_KEY_LENGTH }).notNull(),
    reactionId: t
      .integer()
      .notNull()
      .references(() => core_reactions.id, { onDelete: "cascade" }),
    count: t.integer().notNull().default(0),
    // `nextval('core_reactions_counts_version_seq')` on every write; a
    // target's live `seq` is the highest one among its rows.
    version: t.bigint({ mode: "number" }).notNull().default(0),
  }),
  t => [
    primaryKey({
      columns: [t.pluginId, t.targetType, t.targetId, t.reactionId],
    }),
    index("core_reactions_counts_reaction_idx").on(t.reactionId),
  ],
);
