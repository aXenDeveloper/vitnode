import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { core_mcp_authorization_codes, core_mcp_clients } from "@/database/mcp";

import type { ResolvedMcpConfig } from "../config";
import type { McpScope } from "../scopes";

import { MCP_DEFAULTS } from "../config";
import { MCP_SCOPES, parseMcpScopes } from "../scopes";
import { mcpUrls } from "../urls";
import { matchRegisteredRedirectUri } from "./redirect-uri";
import {
  generateMcpSecret,
  hashMcpSecret,
  isValidCodeChallenge,
} from "./secrets";

/** What the consent page sends, as the client put it in the authorization URL. */
export interface McpAuthorizeParams {
  client_id: string;
  code_challenge: string;
  code_challenge_method: string;
  redirect_uri: string;
  resource?: string;
  response_type: string;
  scope?: string;
  state?: string;
}

export const MCP_AUTHORIZE_ERRORS = [
  "invalid_client",
  "invalid_redirect_uri",
  "invalid_request",
  "invalid_resource",
  "invalid_scope",
  "unsupported_response_type",
] as const;

export type McpAuthorizeError = (typeof MCP_AUTHORIZE_ERRORS)[number];

export interface ValidMcpAuthorizeRequest {
  client: {
    clientId: string;
    id: number;
    name: string;
    uri: null | string;
  };
  codeChallenge: string;
  redirectUri: string;
  resource: string;
  /** The scopes the client asked for; both when it named none. */
  scopes: McpScope[];
  state: string | undefined;
}

const MAX_STATE_LENGTH = 1024;

/** The MCP config of this request: `core.mcp`, set by the global middleware. */
export const mcpConfigOf = (c: Context): ResolvedMcpConfig => c.get("core").mcp;

/**
 * Checks an authorization request without issuing anything. The client and
 * the redirect URI are checked first: until both are known good, nothing may
 * be sent back to the redirect URI. Server-only.
 */
export const validateMcpAuthorizeRequest = async (
  c: Context<EnvVitNode>,
  params: McpAuthorizeParams,
): Promise<
  | { error: McpAuthorizeError; ok: false }
  | { ok: true; request: ValidMcpAuthorizeRequest }
> => {
  const config = mcpConfigOf(c);
  const fail = (error: McpAuthorizeError) => ({ error, ok: false as const });

  const [client] = await c
    .get("db")
    .select({
      clientId: core_mcp_clients.clientId,
      id: core_mcp_clients.id,
      name: core_mcp_clients.name,
      redirectUris: core_mcp_clients.redirectUris,
      uri: core_mcp_clients.uri,
    })
    .from(core_mcp_clients)
    .where(eq(core_mcp_clients.clientId, params.client_id))
    .limit(1);
  if (!client) return fail("invalid_client");

  const redirectUri = matchRegisteredRedirectUri(
    params.redirect_uri,
    client.redirectUris,
    config,
  );
  if (!redirectUri) return fail("invalid_redirect_uri");

  if (params.response_type !== "code") {
    return fail("unsupported_response_type");
  }
  if (
    params.code_challenge_method !== "S256" ||
    !isValidCodeChallenge(params.code_challenge)
  ) {
    return fail("invalid_request");
  }
  if (
    params.state !== undefined &&
    (params.state.length > MAX_STATE_LENGTH || /\p{Cc}/u.test(params.state))
  ) {
    return fail("invalid_request");
  }

  const { resource } = mcpUrls(config);
  if (params.resource !== undefined && params.resource !== resource) {
    return fail("invalid_resource");
  }

  const requested = parseMcpScopes(params.scope);
  if (requested === null) return fail("invalid_scope");

  return {
    ok: true,
    request: {
      client: {
        clientId: client.clientId,
        id: client.id,
        name: client.name,
        uri: client.uri,
      },
      codeChallenge: params.code_challenge,
      redirectUri,
      resource,
      scopes: requested.length > 0 ? requested : [...MCP_SCOPES],
      state: params.state,
    },
  };
};

/**
 * Where the member's browser goes after the consent page: the client's
 * (already validated) redirect URI with a fresh single-use code, or with
 * `error=access_denied`. Both carry `state` and `iss` (RFC 9207).
 */
export const completeMcpAuthorization = async (
  c: Context<EnvVitNode>,
  {
    approvedScopes,
    request,
    userId,
  }: {
    approvedScopes: McpScope[] | null;
    request: ValidMcpAuthorizeRequest;
    userId: number;
  },
): Promise<string> => {
  const target = new URL(request.redirectUri);
  const { issuer } = mcpUrls(mcpConfigOf(c));

  if (approvedScopes === null) {
    target.searchParams.set("error", "access_denied");
  } else {
    const code = generateMcpSecret("code");
    await c
      .get("db")
      .insert(core_mcp_authorization_codes)
      .values({
        clientId: request.client.id,
        codeChallenge: request.codeChallenge,
        codeHash: await hashMcpSecret(code),
        expiresAt: new Date(Date.now() + MCP_DEFAULTS.authorizationCodeTtl),
        redirectUri: request.redirectUri,
        resource: request.resource,
        scopes: approvedScopes,
        userId,
      });
    target.searchParams.set("code", code);
  }

  if (request.state !== undefined) {
    target.searchParams.set("state", request.state);
  }
  target.searchParams.set("iss", issuer);

  return target.href;
};
