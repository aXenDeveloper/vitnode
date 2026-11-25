import type { Context } from "hono";

import { and, eq, gt, isNull } from "drizzle-orm";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import {
  core_mcp_access_tokens,
  core_mcp_authorization_codes,
  core_mcp_clients,
  core_mcp_grants,
} from "@/database/mcp";
import { mcpConnectionCreatedEvent } from "@/events/mcp";

import type { McpScope } from "../scopes";

import { parseMcpScopes } from "../scopes";
import { mcpUrls } from "../urls";
import { mcpConfigOf } from "./authorize";
import {
  deleteExpiredMcpAccessTokens,
  emitMcpGrantsRevoked,
  isMcpUserActive,
  issueMcpAccessToken,
  type McpTokenResponse,
  mcpTokenResponse,
  revokeMcpGrantsWhere,
} from "./grants";
import {
  constantTimeEqual,
  generateMcpSecret,
  hashMcpSecret,
  isValidCodeVerifier,
  MCP_SECRET_PREFIX,
  pkceS256Challenge,
} from "./secrets";

/** RFC 6749 §5.2 error codes, plus RFC 8707's `invalid_target`. */
export type McpTokenErrorCode =
  | "invalid_client"
  | "invalid_grant"
  | "invalid_request"
  | "invalid_scope"
  | "invalid_target"
  | "unsupported_grant_type";

export type McpTokenResult =
  | { body: McpTokenResponse; ok: true }
  | {
      error: McpTokenErrorCode;
      error_description: string;
      ok: false;
    };

const fail = (
  error: McpTokenErrorCode,
  description: string,
): McpTokenResult => ({ error, error_description: description, ok: false });

const MAX_PARAM_LENGTH = 2048;

/** Token request parameters: one string each, or the request is malformed. */
export type McpTokenParams = ReadonlyMap<string, string>;

const findClient = async (c: Context<EnvVitNode>, clientId: string) => {
  const [client] = await c
    .get("db")
    .select({
      clientId: core_mcp_clients.clientId,
      id: core_mcp_clients.id,
      lastUsedAt: core_mcp_clients.lastUsedAt,
      name: core_mcp_clients.name,
    })
    .from(core_mcp_clients)
    .where(eq(core_mcp_clients.clientId, clientId))
    .limit(1);

  return client;
};

const touchClient = async (
  c: Context<EnvVitNode>,
  client: { id: number; lastUsedAt: Date | null },
): Promise<void> => {
  if (client.lastUsedAt && Date.now() - client.lastUsedAt.getTime() < 60_000) {
    return;
  }
  await c
    .get("db")
    .update(core_mcp_clients)
    .set({ lastUsedAt: new Date() })
    .where(eq(core_mcp_clients.id, client.id));
};

const checkResource = (
  c: Context<EnvVitNode>,
  params: McpTokenParams,
  bound: string,
): boolean => {
  const requested = params.get("resource");
  const { resource } = mcpUrls(mcpConfigOf(c));

  // The grant must be for this endpoint, and a client naming a resource must
  // name exactly that one (RFC 8707 §2.2).
  return (
    bound === resource && (requested === undefined || requested === resource)
  );
};

const exchangeAuthorizationCode = async (
  c: Context<EnvVitNode>,
  params: McpTokenParams,
  client: { clientId: string; id: number; name: string },
): Promise<McpTokenResult> => {
  const code = params.get("code");
  const redirectUri = params.get("redirect_uri");
  const codeVerifier = params.get("code_verifier");
  if (!code || !redirectUri || !codeVerifier) {
    return fail(
      "invalid_request",
      "code, redirect_uri and code_verifier are required.",
    );
  }
  if (!isValidCodeVerifier(codeVerifier)) {
    return fail("invalid_request", "code_verifier is malformed.");
  }
  if (!code.startsWith(MCP_SECRET_PREFIX.code)) {
    return fail("invalid_grant", "The authorization code is invalid.");
  }

  const db = c.get("db");
  const codeHash = await hashMcpSecret(code);

  // Consumed in the same statement that finds it: of two concurrent requests
  // with one code, exactly one gets a row back.
  const [row] = await db
    .update(core_mcp_authorization_codes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(core_mcp_authorization_codes.codeHash, codeHash),
        isNull(core_mcp_authorization_codes.consumedAt),
        gt(core_mcp_authorization_codes.expiresAt, new Date()),
      ),
    )
    .returning();

  if (!row) {
    // A second use of a spent code means somebody else has a copy: revoke the
    // connection it produced (RFC 6749 §4.1.2, OAuth 2.1 §4.1.3).
    const [spent] = await db
      .select({
        consumedAt: core_mcp_authorization_codes.consumedAt,
        grantId: core_mcp_authorization_codes.grantId,
      })
      .from(core_mcp_authorization_codes)
      .where(eq(core_mcp_authorization_codes.codeHash, codeHash))
      .limit(1);
    if (spent?.consumedAt && spent.grantId !== null) {
      await revokeMcpGrantsWhere(
        c,
        eq(core_mcp_grants.id, spent.grantId),
        "code_reuse",
      );
    }

    return fail(
      "invalid_grant",
      "The authorization code is invalid or expired.",
    );
  }

  if (row.clientId !== client.id) {
    return fail("invalid_grant", "The code was issued to another client.");
  }
  if (row.redirectUri !== redirectUri) {
    return fail("invalid_grant", "redirect_uri does not match.");
  }
  if (
    !constantTimeEqual(await pkceS256Challenge(codeVerifier), row.codeChallenge)
  ) {
    return fail("invalid_grant", "code_verifier does not match.");
  }
  if (!checkResource(c, params, row.resource)) {
    return fail("invalid_target", "The resource is not this MCP endpoint.");
  }
  if (!(await isMcpUserActive(c, row.userId))) {
    return fail("invalid_grant", "The account cannot connect clients.");
  }

  const config = mcpConfigOf(c);
  const refreshToken = generateMcpSecret("refreshToken");
  const refreshTokenHash = await hashMcpSecret(refreshToken);
  const scopes: McpScope[] = row.scopes;

  const { accessToken, replaced } = await db.transaction(async tx => {
    // Approving the same client again replaces the old connection, so a
    // client that lost its tokens leaves no live refresh token behind.
    const previous = await tx
      .delete(core_mcp_grants)
      .where(
        and(
          eq(core_mcp_grants.userId, row.userId),
          eq(core_mcp_grants.clientId, client.id),
        ),
      )
      .returning({
        clientId: core_mcp_grants.clientId,
        userId: core_mcp_grants.userId,
      });

    const [grant] = await tx
      .insert(core_mcp_grants)
      .values({
        clientId: client.id,
        refreshTokenExpiresAt: new Date(Date.now() + config.refreshTokenTtl),
        refreshTokenHash,
        resource: row.resource,
        scopes,
        userId: row.userId,
      })
      .returning({ id: core_mcp_grants.id });

    await tx
      .update(core_mcp_authorization_codes)
      .set({ grantId: grant.id })
      .where(eq(core_mcp_authorization_codes.id, row.id));

    return {
      accessToken: await issueMcpAccessToken(tx, {
        grantId: grant.id,
        scopes,
        ttl: config.accessTokenTtl,
      }),
      replaced: previous,
    };
  });

  await emitMcpGrantsRevoked(c, replaced, "replaced");
  await c.get("events").emit(mcpConnectionCreatedEvent, {
    clientId: client.clientId,
    clientName: client.name,
    scopes,
    userId: row.userId,
  });

  return {
    body: mcpTokenResponse({
      accessToken,
      accessTokenTtl: config.accessTokenTtl,
      refreshToken,
      scopes,
    }),
    ok: true,
  };
};

const refreshAccessToken = async (
  c: Context<EnvVitNode>,
  params: McpTokenParams,
  client: { clientId: string; id: number },
): Promise<McpTokenResult> => {
  const presented = params.get("refresh_token");
  if (!presented) return fail("invalid_request", "refresh_token is required.");
  if (!presented.startsWith(MCP_SECRET_PREFIX.refreshToken)) {
    return fail("invalid_grant", "The refresh token is invalid.");
  }

  const db = c.get("db");
  const presentedHash = await hashMcpSecret(presented);

  const [grant] = await db
    .select()
    .from(core_mcp_grants)
    .where(eq(core_mcp_grants.refreshTokenHash, presentedHash))
    .limit(1);

  if (!grant) {
    // An already rotated token: whoever presents it is not the client that
    // rotated it last, so neither copy can be trusted (OAuth 2.1 §4.3.1).
    await revokeMcpGrantsWhere(
      c,
      eq(core_mcp_grants.previousRefreshTokenHash, presentedHash),
      "refresh_reuse",
    );

    return fail("invalid_grant", "The refresh token is invalid or expired.");
  }
  if (grant.clientId !== client.id) {
    return fail(
      "invalid_grant",
      "The refresh token belongs to another client.",
    );
  }
  if (grant.refreshTokenExpiresAt.getTime() <= Date.now()) {
    await db.delete(core_mcp_grants).where(eq(core_mcp_grants.id, grant.id));

    return fail("invalid_grant", "The refresh token is invalid or expired.");
  }
  if (!checkResource(c, params, grant.resource)) {
    return fail("invalid_target", "The resource is not this MCP endpoint.");
  }

  let scopes: McpScope[] = grant.scopes;
  const scopeParam = params.get("scope");
  if (scopeParam !== undefined) {
    const requested = parseMcpScopes(scopeParam);
    if (
      requested === null ||
      requested.length === 0 ||
      requested.some(scope => !grant.scopes.includes(scope))
    ) {
      return fail(
        "invalid_scope",
        "scope may only narrow the approved scopes.",
      );
    }
    scopes = requested;
  }

  if (!(await isMcpUserActive(c, grant.userId))) {
    return fail("invalid_grant", "The account cannot use clients right now.");
  }

  const config = mcpConfigOf(c);
  const refreshToken = generateMcpSecret("refreshToken");
  const refreshTokenHash = await hashMcpSecret(refreshToken);

  const accessToken = await db.transaction(async tx => {
    // Conditional on the hash still being current, so of two concurrent
    // refreshes with one token only one rotates it.
    const [rotated] = await tx
      .update(core_mcp_grants)
      .set({
        lastUsedAt: new Date(),
        previousRefreshTokenHash: presentedHash,
        refreshTokenExpiresAt: new Date(Date.now() + config.refreshTokenTtl),
        refreshTokenHash,
      })
      .where(
        and(
          eq(core_mcp_grants.id, grant.id),
          eq(core_mcp_grants.refreshTokenHash, presentedHash),
        ),
      )
      .returning({ id: core_mcp_grants.id });
    if (!rotated) return null;

    await deleteExpiredMcpAccessTokens(tx, grant.id);

    return await issueMcpAccessToken(tx, {
      grantId: grant.id,
      scopes,
      ttl: config.accessTokenTtl,
    });
  });

  if (accessToken === null) {
    return fail("invalid_grant", "The refresh token is invalid or expired.");
  }

  return {
    body: mcpTokenResponse({
      accessToken,
      accessTokenTtl: config.accessTokenTtl,
      refreshToken,
      scopes,
    }),
    ok: true,
  };
};

/**
 * The token endpoint (RFC 6749 §3.2) for public clients: the
 * `authorization_code` grant with PKCE, and `refresh_token` with rotation and
 * reuse detection. Server-only.
 */
export const handleMcpTokenRequest = async (
  c: Context<EnvVitNode>,
  params: McpTokenParams,
): Promise<McpTokenResult> => {
  for (const value of params.values()) {
    if (value.length > MAX_PARAM_LENGTH) {
      return fail("invalid_request", "A parameter is too long.");
    }
  }

  const grantType = params.get("grant_type");
  if (!grantType) return fail("invalid_request", "grant_type is required.");
  if (grantType !== "authorization_code" && grantType !== "refresh_token") {
    return fail(
      "unsupported_grant_type",
      "Use authorization_code or refresh_token.",
    );
  }

  const clientId = params.get("client_id");
  if (!clientId) return fail("invalid_client", "client_id is required.");
  const client = await findClient(c, clientId);
  if (!client) return fail("invalid_client", "Unknown client_id.");

  const result =
    grantType === "authorization_code"
      ? await exchangeAuthorizationCode(c, params, client)
      : await refreshAccessToken(c, params, client);

  if (result.ok) await touchClient(c, client);

  return result;
};

/**
 * Token revocation (RFC 7009). A refresh token ends its whole connection; an
 * access token only itself. Unknown tokens, and tokens of another client than
 * the `client_id` sent, are ignored - the answer is the same either way.
 * Server-only.
 */
export const handleMcpRevokeRequest = async (
  c: Context<EnvVitNode>,
  params: McpTokenParams,
): Promise<{ error?: "invalid_request" }> => {
  const token = params.get("token");
  if (!token || token.length > MAX_PARAM_LENGTH) {
    return { error: "invalid_request" };
  }

  const clientId = params.get("client_id");
  const client = clientId ? await findClient(c, clientId) : undefined;
  if (clientId && !client) return {};

  const db = c.get("db");
  const hash = await hashMcpSecret(token);

  if (token.startsWith(MCP_SECRET_PREFIX.refreshToken)) {
    await revokeMcpGrantsWhere(
      c,
      and(
        eq(core_mcp_grants.refreshTokenHash, hash),
        client ? eq(core_mcp_grants.clientId, client.id) : undefined,
      ),
      "token_revoked",
    );

    return {};
  }

  if (token.startsWith(MCP_SECRET_PREFIX.accessToken)) {
    const [owned] = await db
      .select({ id: core_mcp_access_tokens.id })
      .from(core_mcp_access_tokens)
      .innerJoin(
        core_mcp_grants,
        eq(core_mcp_grants.id, core_mcp_access_tokens.grantId),
      )
      .where(
        and(
          eq(core_mcp_access_tokens.tokenHash, hash),
          client ? eq(core_mcp_grants.clientId, client.id) : undefined,
        ),
      )
      .limit(1);
    if (owned) {
      await db
        .delete(core_mcp_access_tokens)
        .where(eq(core_mcp_access_tokens.id, owned.id));
    }
  }

  return {};
};
