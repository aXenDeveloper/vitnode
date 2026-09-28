import { sql } from "drizzle-orm";
import { camelCase, index } from "drizzle-orm/pg-core";

import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/passkey";

import { core_users } from "./users";

export const core_users_passkeys = camelCase.table.withRLS(
  "core_users_passkeys",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, {
        onDelete: "cascade",
      }),
    credentialId: t.varchar({ length: 1024 }).notNull().unique(),
    publicKey: t.text().notNull(),
    counter: t.bigint({ mode: "number" }).notNull().default(0),
    webauthnUserId: t.varchar({ length: 128 }).notNull(),
    transports: t
      .varchar({ length: 32 })
      .array()
      .notNull()
      .default(sql`'{}'::varchar[]`),
    deviceType: t.varchar({ length: 32 }).notNull(),
    backedUp: t.boolean().notNull().default(false),
    aaguid: t.varchar({ length: 36 }),
    name: t.varchar({ length: PASSKEY_NAME_MAX_LENGTH }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    updatedAt: t
      .timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    lastUsedAt: t.timestamp(),
  }),
  t => [
    index("core_users_passkeys_user_id_idx").on(t.userId),
    index("core_users_passkeys_webauthn_user_id_idx").on(t.webauthnUserId),
  ],
);

export const core_users_passkey_challenges = camelCase.table.withRLS(
  "core_users_passkey_challenges",
  t => ({
    id: t.serial().primaryKey(),
    tokenHash: t.varchar({ length: 64 }).notNull().unique(),
    ceremony: t.varchar({ length: 16 }).notNull(),
    challenge: t.varchar({ length: 128 }).notNull(),
    userId: t.integer().references(() => core_users.id, {
      onDelete: "cascade",
    }),
    webauthnUserId: t.varchar({ length: 128 }),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [
    index("core_users_passkey_challenges_expires_at_idx").on(t.expiresAt),
    index("core_users_passkey_challenges_user_id_idx").on(t.userId),
  ],
);
