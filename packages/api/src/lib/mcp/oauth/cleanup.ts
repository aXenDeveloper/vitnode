import { and, eq, isNull, lt, notExists, or, sql } from "drizzle-orm";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import {
  core_mcp_access_tokens,
  core_mcp_authorization_codes,
  core_mcp_clients,
  core_mcp_grants,
} from "@/database/mcp";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

// A registration nobody connected with is dropped after this long. A client
// still holding its id then gets `invalid_client` and registers again.
const UNUSED_CLIENT_TTL = 30 * DAY;

/**
 * Deletes what the MCP OAuth server no longer needs: expired access tokens,
 * connections whose refresh token expired, authorization codes an hour past
 * expiry (kept that long to catch a replay), and client registrations with no
 * connection that were not used for 30 days. Run by the `clean` cron.
 * Server-only.
 */
export const deleteExpiredMcpOAuthRows = async (
  db: EnvVitNode["Variables"]["db"],
): Promise<void> => {
  const now = Date.now();

  await db
    .delete(core_mcp_access_tokens)
    .where(lt(core_mcp_access_tokens.expiresAt, new Date(now)));
  await db
    .delete(core_mcp_grants)
    .where(lt(core_mcp_grants.refreshTokenExpiresAt, new Date(now)));
  await db
    .delete(core_mcp_authorization_codes)
    .where(lt(core_mcp_authorization_codes.expiresAt, new Date(now - HOUR)));

  const cutoff = new Date(now - UNUSED_CLIENT_TTL);
  await db.delete(core_mcp_clients).where(
    and(
      lt(core_mcp_clients.createdAt, cutoff),
      or(
        isNull(core_mcp_clients.lastUsedAt),
        lt(core_mcp_clients.lastUsedAt, cutoff),
      ),
      notExists(
        db
          .select({ one: sql`1` })
          .from(core_mcp_grants)
          .where(eq(core_mcp_grants.clientId, core_mcp_clients.id)),
      ),
    ),
  );
};
