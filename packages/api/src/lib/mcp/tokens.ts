import type { Context } from "hono";

import { and, desc, eq, isNull } from "drizzle-orm";

import { core_mcp_tokens } from "@/database/mcp";
import { hashSessionToken } from "@/lib/session-token";

/** Every MCP token starts with this, so a leaked one is recognisable in a scan. */
export const MCP_TOKEN_PREFIX = "vnmcp_";
/** How many characters of a token a list shows. */
const DISPLAY_PREFIX_LENGTH = MCP_TOKEN_PREFIX.length + 8;
/** `lastUsedAt` is written at most this often per token. */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

/** A token as its owner sees it in a list - never the token or its hash. */
export interface McpTokenSummary {
  createdAt: Date;
  expiresAt: Date;
  id: number;
  label: string;
  lastUsedAt: Date | null;
  prefix: string;
  revokedAt: Date | null;
  tools: string[];
}

/** A verified token: who it acts as and what it may call. */
export interface McpTokenGrant {
  id: number;
  lastUsedAt: Date | null;
  tools: ReadonlySet<string>;
  userId: number;
}

const summaryColumns = {
  createdAt: core_mcp_tokens.createdAt,
  expiresAt: core_mcp_tokens.expiresAt,
  id: core_mcp_tokens.id,
  label: core_mcp_tokens.label,
  lastUsedAt: core_mcp_tokens.lastUsedAt,
  prefix: core_mcp_tokens.prefix,
  revokedAt: core_mcp_tokens.revokedAt,
  tools: core_mcp_tokens.tools,
};

/**
 * Creates a token for `userId` and returns it once - only its SHA-256 is
 * stored, so it can never be shown again. 256 bits of randomness, which is
 * what makes a plain hash (no salt, no slow KDF) the right storage.
 */
export const createMcpToken = async (
  c: Context,
  {
    expiresAt,
    label,
    tools,
    userId,
  }: { expiresAt: Date; label: string; tools: string[]; userId: number },
): Promise<{ summary: McpTokenSummary; token: string }> => {
  const secret = new Uint8Array(32);
  crypto.getRandomValues(secret);
  const token = `${MCP_TOKEN_PREFIX}${base64Url(secret)}`;

  const [row] = await c
    .get("db")
    .insert(core_mcp_tokens)
    .values({
      expiresAt,
      label,
      prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
      tokenHash: await hashSessionToken(token),
      tools: [...new Set(tools)].sort(),
      userId,
    })
    .returning(summaryColumns);

  return { summary: row, token };
};

/** The owner's tokens, newest first, revoked and expired ones included. */
export const listMcpTokens = async (
  c: Context,
  userId: number,
): Promise<McpTokenSummary[]> =>
  await c
    .get("db")
    .select(summaryColumns)
    .from(core_mcp_tokens)
    .where(eq(core_mcp_tokens.userId, userId))
    .orderBy(desc(core_mcp_tokens.createdAt), desc(core_mcp_tokens.id));

/**
 * Revokes one of the owner's tokens. The next request with it is refused -
 * nothing caches a verified token.
 *
 * @returns The revoked token, or `null` when the owner has no such live token.
 */
export const revokeMcpToken = async (
  c: Context,
  { id, userId }: { id: number; userId: number },
): Promise<McpTokenSummary | null> => {
  const [row] = await c
    .get("db")
    .update(core_mcp_tokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(core_mcp_tokens.id, id),
        eq(core_mcp_tokens.userId, userId),
        isNull(core_mcp_tokens.revokedAt),
      ),
    )
    .returning(summaryColumns);

  return row ?? null;
};

/**
 * Resolves a bearer token, on every request: unknown, revoked and expired
 * tokens are `null`. The owner's account is checked by the caller.
 */
export const verifyMcpToken = async (
  c: Context,
  token: string,
): Promise<McpTokenGrant | null> => {
  if (!token.startsWith(MCP_TOKEN_PREFIX) || token.length > 128) return null;

  const [row] = await c
    .get("db")
    .select({
      expiresAt: core_mcp_tokens.expiresAt,
      id: core_mcp_tokens.id,
      lastUsedAt: core_mcp_tokens.lastUsedAt,
      revokedAt: core_mcp_tokens.revokedAt,
      tools: core_mcp_tokens.tools,
      userId: core_mcp_tokens.userId,
    })
    .from(core_mcp_tokens)
    .where(eq(core_mcp_tokens.tokenHash, await hashSessionToken(token)))
    .limit(1);

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    id: row.id,
    lastUsedAt: row.lastUsedAt,
    tools: new Set(row.tools),
    userId: row.userId,
  };
};

/** Records that a token was used, at most once per few minutes. */
export const touchMcpToken = async (
  c: Context,
  grant: McpTokenGrant,
): Promise<void> => {
  if (
    grant.lastUsedAt &&
    Date.now() - grant.lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS
  ) {
    return;
  }

  await c
    .get("db")
    .update(core_mcp_tokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(core_mcp_tokens.id, grant.id));
};
