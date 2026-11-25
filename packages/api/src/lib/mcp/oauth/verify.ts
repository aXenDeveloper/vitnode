import type { Context } from "hono";

import { and, eq, gt, lt } from "drizzle-orm";

import {
  core_mcp_access_tokens,
  core_mcp_clients,
  core_mcp_grants,
} from "@/database/mcp";
import { findActiveSuspension } from "@/lib/moderation/warnings/suspension";

import type { McpPrincipal } from "../principal";

import { formatMcpScopes, MCP_SCOPES } from "../scopes";
import { mcpUrls } from "../urls";
import { mcpConfigOf } from "./authorize";
import { hashMcpSecret, MCP_SECRET_PREFIX } from "./secrets";

const LAST_USED_RESOLUTION = 60_000;

// RFC 6750 §2.1: `Bearer` + one space + a b64token, and nothing else.
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/;

/**
 * The token from an `Authorization: Bearer <token>` header, or `undefined`
 * when the header is missing or not exactly that shape.
 */
export const mcpBearerToken = (
  header: string | undefined,
): string | undefined => {
  if (!header) return undefined;

  return BEARER.exec(header)?.[1];
};

/**
 * The `401` (or `403` for `insufficient_scope`) an MCP request without a
 * usable token gets. `WWW-Authenticate` points the client at the protected
 * resource metadata, where it discovers how to get a token (RFC 9728 §5.1).
 * Without `error` it is the plain "authenticate first" challenge
 * (RFC 6750 §3.1). Server-only.
 */
export const mcpUnauthorizedResponse = (
  c: Context,
  opts: { error?: "insufficient_scope" | "invalid_token"; scope?: string } = {},
): Response => {
  const { protectedResourceMetadata } = mcpUrls(mcpConfigOf(c));
  const scope = opts.scope ?? formatMcpScopes(MCP_SCOPES);
  const params = [
    `resource_metadata="${protectedResourceMetadata}"`,
    `scope="${scope}"`,
    ...(opts.error ? [`error="${opts.error}"`] : []),
  ];
  const status = opts.error === "insufficient_scope" ? 403 : 401;
  let description = "Sign in to use this MCP server.";
  if (opts.error === "invalid_token") {
    description = "The access token is invalid, expired or revoked.";
  } else if (opts.error === "insufficient_scope") {
    description = `This needs the "${scope}" scope.`;
  }

  return new Response(
    JSON.stringify({
      error: opts.error ?? "unauthorized",
      error_description: description,
    }),
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer ${params.join(", ")}`,
      },
      status,
    },
  );
};

/**
 * Resolves the member an MCP request acts for from its bearer token. The
 * token must be one VitNode issued, unexpired, bound to this endpoint
 * (`resource`), and its member must exist and not be suspended. Any failure
 * is the `401` to send as is. Server-only.
 */
export const authenticateMcpRequest = async (
  c: Context,
): Promise<
  { ok: false; response: Response } | { ok: true; principal: McpPrincipal }
> => {
  const header = c.req.header("authorization");
  if (!header) {
    return { ok: false, response: mcpUnauthorizedResponse(c) };
  }

  const invalid = () => ({
    ok: false as const,
    response: mcpUnauthorizedResponse(c, { error: "invalid_token" }),
  });

  const token = mcpBearerToken(header);
  if (!token?.startsWith(MCP_SECRET_PREFIX.accessToken)) return invalid();

  const now = new Date();
  const [row] = await c
    .get("db")
    .select({
      clientId: core_mcp_clients.clientId,
      grantId: core_mcp_grants.id,
      lastUsedAt: core_mcp_grants.lastUsedAt,
      resource: core_mcp_grants.resource,
      scopes: core_mcp_access_tokens.scopes,
      userId: core_mcp_grants.userId,
    })
    .from(core_mcp_access_tokens)
    .innerJoin(
      core_mcp_grants,
      eq(core_mcp_grants.id, core_mcp_access_tokens.grantId),
    )
    .innerJoin(
      core_mcp_clients,
      eq(core_mcp_clients.id, core_mcp_grants.clientId),
    )
    .where(
      and(
        eq(core_mcp_access_tokens.tokenHash, await hashMcpSecret(token)),
        gt(core_mcp_access_tokens.expiresAt, now),
        gt(core_mcp_grants.refreshTokenExpiresAt, now),
      ),
    )
    .limit(1);
  if (!row) return invalid();

  // Audience check (RFC 8707): a token minted for another resource - another
  // install, or this one before it moved - never works here.
  if (row.resource !== mcpUrls(mcpConfigOf(c)).resource) return invalid();

  // The user row is guaranteed by the cascade; a suspension is not.
  if (await findActiveSuspension(c, row.userId, now)) return invalid();

  if (now.getTime() - row.lastUsedAt.getTime() >= LAST_USED_RESOLUTION) {
    await c
      .get("db")
      .update(core_mcp_grants)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(core_mcp_grants.id, row.grantId),
          lt(
            core_mcp_grants.lastUsedAt,
            new Date(now.getTime() - LAST_USED_RESOLUTION),
          ),
        ),
      );
  }

  return {
    ok: true,
    principal: {
      clientId: row.clientId,
      grantId: row.grantId,
      scopes: row.scopes,
      userId: row.userId,
    },
  };
};
