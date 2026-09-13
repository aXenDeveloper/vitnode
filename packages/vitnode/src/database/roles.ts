import { camelCase } from "drizzle-orm/pg-core";

export const core_roles = camelCase.table.withRLS("core_roles", t => ({
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
}));
