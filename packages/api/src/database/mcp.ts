import { camelCase, index } from "drizzle-orm/pg-core";

import type { McpScope } from "../lib/mcp/scopes";

import { core_users } from "./users";

/**
 * MCP clients registered through OAuth Dynamic Client Registration (RFC 7591).
 * Public clients only: there is no secret, PKCE protects every code.
 */
export const core_mcp_clients = camelCase.table.withRLS(
  "core_mcp_clients",
  t => ({
    id: t.serial().primaryKey(),
    clientId: t.varchar({ length: 64 }).notNull().unique(),
    name: t.varchar({ length: 100 }).notNull(),
    uri: t.varchar({ length: 512 }),
    redirectUris: t.jsonb().$type<string[]>().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    lastUsedAt: t.timestamp(),
  }),
  t => [index("core_mcp_clients_created_at_idx").on(t.createdAt)],
);

/**
 * A member's connection to an MCP client: what they approved, and the current
 * refresh token. Deleting the row revokes the connection and, by cascade,
 * every access token it issued.
 */
export const core_mcp_grants = camelCase.table.withRLS(
  "core_mcp_grants",
  t => ({
    id: t.serial().primaryKey(),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    clientId: t
      .integer()
      .notNull()
      .references(() => core_mcp_clients.id, { onDelete: "cascade" }),
    scopes: t.jsonb().$type<McpScope[]>().notNull(),
    resource: t.varchar({ length: 512 }).notNull(),
    // SHA-256 of the current refresh token; the token itself is never stored.
    refreshTokenHash: t.varchar({ length: 64 }).notNull().unique(),
    // The token the current one replaced. Presenting it again means a copy
    // leaked, so the whole connection is revoked.
    previousRefreshTokenHash: t.varchar({ length: 64 }).unique(),
    refreshTokenExpiresAt: t.timestamp().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    lastUsedAt: t.timestamp().notNull().defaultNow(),
  }),
  t => [
    index("core_mcp_grants_user_id_idx").on(t.userId),
    index("core_mcp_grants_client_id_idx").on(t.clientId),
    index("core_mcp_grants_refresh_token_expires_at_idx").on(
      t.refreshTokenExpiresAt,
    ),
  ],
);

/** Single-use authorization codes, stored as SHA-256 hashes. */
export const core_mcp_authorization_codes = camelCase.table.withRLS(
  "core_mcp_authorization_codes",
  t => ({
    id: t.serial().primaryKey(),
    codeHash: t.varchar({ length: 64 }).notNull().unique(),
    clientId: t
      .integer()
      .notNull()
      .references(() => core_mcp_clients.id, { onDelete: "cascade" }),
    userId: t
      .integer()
      .notNull()
      .references(() => core_users.id, { onDelete: "cascade" }),
    redirectUri: t.varchar({ length: 2048 }).notNull(),
    codeChallenge: t.varchar({ length: 128 }).notNull(),
    scopes: t.jsonb().$type<McpScope[]>().notNull(),
    resource: t.varchar({ length: 512 }).notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
    consumedAt: t.timestamp(),
    // The connection this code was exchanged for, revoked if the code is
    // presented a second time.
    grantId: t
      .integer()
      .references(() => core_mcp_grants.id, { onDelete: "set null" }),
  }),
  t => [
    index("core_mcp_authorization_codes_client_id_idx").on(t.clientId),
    index("core_mcp_authorization_codes_user_id_idx").on(t.userId),
    index("core_mcp_authorization_codes_grant_id_idx").on(t.grantId),
    index("core_mcp_authorization_codes_expires_at_idx").on(t.expiresAt),
  ],
);

/** Short-lived access tokens, stored as SHA-256 hashes. */
export const core_mcp_access_tokens = camelCase.table.withRLS(
  "core_mcp_access_tokens",
  t => ({
    id: t.serial().primaryKey(),
    tokenHash: t.varchar({ length: 64 }).notNull().unique(),
    grantId: t
      .integer()
      .notNull()
      .references(() => core_mcp_grants.id, { onDelete: "cascade" }),
    // May be narrower than the grant's: a refresh can ask for fewer scopes.
    scopes: t.jsonb().$type<McpScope[]>().notNull(),
    createdAt: t.timestamp().notNull().defaultNow(),
    expiresAt: t.timestamp().notNull(),
  }),
  t => [
    index("core_mcp_access_tokens_grant_id_idx").on(t.grantId),
    index("core_mcp_access_tokens_expires_at_idx").on(t.expiresAt),
  ],
);
