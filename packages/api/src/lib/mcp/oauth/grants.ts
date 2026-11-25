import type { Context } from "hono";

import { and, eq, inArray, lt, type SQL } from "drizzle-orm";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import {
  core_mcp_access_tokens,
  core_mcp_clients,
  core_mcp_grants,
} from "@/database/mcp";
import { core_users } from "@/database/users";
import {
  mcpConnectionRevokedEvent,
  type McpConnectionRevokeReason,
} from "@/events/mcp";
import { findActiveSuspension } from "@/lib/moderation/warnings/suspension";

import type { McpScope } from "../scopes";

import { formatMcpScopes } from "../scopes";
import { generateMcpSecret, hashMcpSecret } from "./secrets";

type Db = EnvVitNode["Variables"]["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The RFC 6749 §5.1 token response. */
export interface McpTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: "Bearer";
}

/**
 * Whether the member may hold MCP tokens right now: the account exists and is
 * not suspended. Server-only.
 */
export const isMcpUserActive = async (
  c: Context,
  userId: number,
): Promise<boolean> => {
  const [user] = await c
    .get("db")
    .select({ id: core_users.id })
    .from(core_users)
    .where(eq(core_users.id, userId))
    .limit(1);
  if (!user) return false;

  return (await findActiveSuspension(c, userId)) === null;
};

/** Stores a new access token for a grant and returns the raw token. */
export const issueMcpAccessToken = async (
  db: Db | Tx,
  {
    grantId,
    scopes,
    ttl,
  }: { grantId: number; scopes: readonly McpScope[]; ttl: number },
): Promise<string> => {
  const token = generateMcpSecret("accessToken");
  await db.insert(core_mcp_access_tokens).values({
    expiresAt: new Date(Date.now() + ttl),
    grantId,
    scopes: [...scopes],
    tokenHash: await hashMcpSecret(token),
  });

  return token;
};

export const mcpTokenResponse = ({
  accessToken,
  accessTokenTtl,
  refreshToken,
  scopes,
}: {
  accessToken: string;
  accessTokenTtl: number;
  refreshToken: string;
  scopes: readonly McpScope[];
}): McpTokenResponse => ({
  access_token: accessToken,
  expires_in: Math.floor(accessTokenTtl / 1000),
  refresh_token: refreshToken,
  scope: formatMcpScopes(scopes),
  token_type: "Bearer",
});

/** Drops a grant's access tokens that have already expired. */
export const deleteExpiredMcpAccessTokens = async (
  db: Db | Tx,
  grantId: number,
): Promise<void> => {
  await db
    .delete(core_mcp_access_tokens)
    .where(
      and(
        eq(core_mcp_access_tokens.grantId, grantId),
        lt(core_mcp_access_tokens.expiresAt, new Date()),
      ),
    );
};

/**
 * Deletes the grants `where` matches - their access tokens go with them - and
 * emits `mcp.connection.revoked` for each. Returns how many ended.
 */
export const revokeMcpGrantsWhere = async (
  c: Context,
  where: SQL | undefined,
  reason: McpConnectionRevokeReason,
): Promise<number> => {
  const db = c.get("db");
  const revoked = await db.delete(core_mcp_grants).where(where).returning({
    clientId: core_mcp_grants.clientId,
    userId: core_mcp_grants.userId,
  });

  await emitMcpGrantsRevoked(c, revoked, reason);

  return revoked.length;
};

/** Emits `mcp.connection.revoked` for grants already deleted. */
export const emitMcpGrantsRevoked = async (
  c: Context,
  revoked: readonly { clientId: number; userId: number }[],
  reason: McpConnectionRevokeReason,
): Promise<void> => {
  if (revoked.length === 0) return;

  const clients = await c
    .get("db")
    .select({ clientId: core_mcp_clients.clientId, id: core_mcp_clients.id })
    .from(core_mcp_clients)
    .where(
      inArray(
        core_mcp_clients.id,
        revoked.map(row => row.clientId),
      ),
    );
  const publicIds = new Map(clients.map(row => [row.id, row.clientId]));

  for (const row of revoked) {
    await c.get("events").emit(mcpConnectionRevokedEvent, {
      clientId: publicIds.get(row.clientId) ?? "",
      reason,
      userId: row.userId,
    });
  }
};

/**
 * Ends every MCP connection of a member, so no AI client keeps acting for
 * them. Call it whenever their credentials stop being trusted: a password
 * change or reset, signing them out everywhere, a deletion request. Account
 * erasure needs nothing - the grants cascade with the user row. Server-only.
 */
export const revokeMcpGrantsForUser = async (
  c: Context,
  userId: number,
  reason: McpConnectionRevokeReason,
): Promise<number> =>
  await revokeMcpGrantsWhere(c, eq(core_mcp_grants.userId, userId), reason);
