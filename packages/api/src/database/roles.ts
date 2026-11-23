import { camelCase, index } from "drizzle-orm/pg-core";

import { ROLE_DEFAULT_MAX_MENTIONS_PER_ITEM } from "@/lib/mentions/limits";

export const core_roles = camelCase.table.withRLS(
  "core_roles",
  t => ({
    id: t.serial().primaryKey(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    protected: t.boolean().notNull().default(false),
    default: t.boolean().notNull().default(false),
    root: t.boolean().notNull().default(false),
    guest: t.boolean().notNull().default(false),
    color: t.varchar({ length: 50 }),
    prefix: t.varchar({ length: 64 }),
    allowUploadFiles: t.boolean().notNull().default(false),
    totalMaxStorage: t.integer(),
    maxStorageForSubmit: t.integer(),
    allowUploadAvatar: t.boolean().notNull().default(true),
    maxAvatarSize: t.integer().notNull().default(2048),
    allowUploadCover: t.boolean().notNull().default(true),
    maxCoverSize: t.integer().notNull().default(5120),
    allowEditPersonalInfo: t.boolean().notNull().default(true),
    /** Members of this role may delete their own account from their settings. */
    allowDeleteAccount: t.boolean().notNull().default(true),
    allowBrowseAnonymously: t.boolean().notNull().default(true),
    forceBrowseAnonymously: t.boolean().notNull().default(false),
    allowEditOwnContent: t.boolean().notNull().default(true),
    editOwnContentMinutes: t.integer(),
    allowDeleteOwnContent: t.boolean().notNull().default(false),
    allowHideOwnContent: t.boolean().notNull().default(false),
    allowReact: t.boolean().notNull().default(true),
    allowReactOwnContent: t.boolean().notNull().default(true),
    // Different reactions one member gives one item; null = unlimited.
    maxReactionsPerItem: t.integer().default(1),
    // Reactions per day over every reaction; null = unlimited.
    reactionsPerDay: t.integer(),
    /** Members of this role may `@mention` others and so notify them. */
    allowMentions: t.boolean().notNull().default(true),
    // Members one post of theirs notifies by mentions; null = unlimited.
    maxMentionsPerItem: t.integer().default(ROLE_DEFAULT_MAX_MENTIONS_PER_ITEM),
  }),
  t => [index("core_roles_updated_at_id_idx").on(t.updatedAt, t.id)],
);
