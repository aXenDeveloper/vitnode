import type { Context, Hono } from "hono";

import { bodyLimit } from "hono/body-limit";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { MCP_SCOPES } from "../scopes";
import { MCP_WELL_KNOWN, mcpUrls } from "../urls";
import { mcpConfigOf } from "./authorize";
import { MCP_GRANT_TYPES, registerMcpClient } from "./register";
import {
  handleMcpRevokeRequest,
  handleMcpTokenRequest,
  type McpTokenParams,
} from "./token";

// Registration metadata is a few hundred bytes; token requests less.
const MAX_OAUTH_BODY = 16 * 1024;

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" } as const;

const oauthBodyLimit = bodyLimit({
  maxSize: MAX_OAUTH_BODY,
  onError: c =>
    c.json(
      {
        error: "invalid_request",
        error_description: "Request body too large.",
      },
      413,
      NO_STORE,
    ),
});

const isJson = (c: Context) =>
  (c.req.header("content-type") ?? "")
    .toLowerCase()
    .startsWith("application/json");

/**
 * Reads a token or revocation request: `application/x-www-form-urlencoded`
 * as RFC 6749 requires, or a flat JSON object of strings. `null` when the body
 * is malformed or names a parameter twice (RFC 6749 §3.2).
 */
const readParams = async (c: Context): Promise<McpTokenParams | null> => {
  const params = new Map<string, string>();

  if (isJson(c)) {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return null;
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") return null;
      params.set(key, value);
    }

    return params;
  }

  const contentType = (c.req.header("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/x-www-form-urlencoded")) return null;

  for (const [key, value] of new URLSearchParams(await c.req.text())) {
    if (params.has(key)) return null;
    // An empty value is the same as leaving the parameter out (RFC 6749 §3.1).
    if (value !== "") params.set(key, value);
  }

  return params;
};

/**
 * Mounts the OAuth 2.1 authorization server of the MCP endpoint on its Hono
 * sub-app (the one served at `/mcp`): the protected resource and authorization
 * server metadata, Dynamic Client Registration, the token endpoint and token
 * revocation. The consent page itself is the web app's `/oauth/authorize`,
 * backed by the `mcp` module's member routes. Every response is
 * `Cache-Control: no-store` and none reads or sets a cookie. Server-only.
 */
export const registerMcpOAuthRoutes = (mcpApp: Hono<EnvVitNode>): void => {
  mcpApp.get(`/.well-known/${MCP_WELL_KNOWN.protectedResource}`, c => {
    const urls = mcpUrls(mcpConfigOf(c));

    // RFC 9728 §3.2
    return c.json(
      {
        resource: urls.resource,
        authorization_servers: [urls.issuer],
        bearer_methods_supported: ["header"],
        resource_name: c.get("core").metadata.title,
        scopes_supported: [...MCP_SCOPES],
      },
      200,
      NO_STORE,
    );
  });

  mcpApp.get(`/.well-known/${MCP_WELL_KNOWN.authorizationServer}`, c => {
    const urls = mcpUrls(mcpConfigOf(c));

    // RFC 8414 §2
    return c.json(
      {
        issuer: urls.issuer,
        authorization_endpoint: urls.authorize,
        token_endpoint: urls.token,
        registration_endpoint: urls.register,
        revocation_endpoint: urls.revoke,
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: [...MCP_GRANT_TYPES],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        revocation_endpoint_auth_methods_supported: ["none"],
        scopes_supported: [...MCP_SCOPES],
        authorization_response_iss_parameter_supported: true,
        client_id_metadata_document_supported: false,
      },
      200,
      NO_STORE,
    );
  });

  mcpApp.post("/oauth/register", oauthBodyLimit, async c => {
    if (!isJson(c)) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "Send the client metadata as application/json.",
        },
        400,
        NO_STORE,
      );
    }

    let metadata: unknown;
    try {
      metadata = await c.req.json();
    } catch {
      metadata = null;
    }

    const result = await registerMcpClient(c, metadata);

    return result.ok
      ? c.json(result.body, 201, NO_STORE)
      : c.json(result.body, 400, NO_STORE);
  });

  mcpApp.post("/oauth/token", oauthBodyLimit, async c => {
    const params = await readParams(c);
    if (!params) {
      return c.json(
        {
          error: "invalid_request",
          error_description:
            "Send each parameter once, form-encoded (application/x-www-form-urlencoded).",
        },
        400,
        NO_STORE,
      );
    }

    const result = await handleMcpTokenRequest(c, params);
    if (result.ok) return c.json(result.body, 200, NO_STORE);

    return c.json(
      { error: result.error, error_description: result.error_description },
      result.error === "invalid_client" ? 401 : 400,
      NO_STORE,
    );
  });

  mcpApp.post("/oauth/revoke", oauthBodyLimit, async c => {
    const params = await readParams(c);
    const result = params
      ? await handleMcpRevokeRequest(c, params)
      : { error: "invalid_request" as const };

    // RFC 7009 §2.2: an unknown or already invalid token is still a success.
    return result.error
      ? c.json(
          { error: result.error, error_description: "token is required." },
          400,
          NO_STORE,
        )
      : c.body(null, 200, NO_STORE);
  });
};
