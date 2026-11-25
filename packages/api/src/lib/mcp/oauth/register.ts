import type { Context } from "hono";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { core_mcp_clients } from "@/database/mcp";

import { mcpConfigOf } from "./authorize";
import { isRegistrableRedirectUri } from "./redirect-uri";
import { randomBase64Url } from "./secrets";

const MAX_REDIRECT_URIS = 5;
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_CLIENT_URI_LENGTH = 512;

export const MCP_GRANT_TYPES = ["authorization_code", "refresh_token"] as const;

// A client asking for a secret still gets a public registration: RFC 7591 §3.2.1
// lets the server replace what it does not support, and the response says
// `none`, which is what the client then uses. PKCE protects every code.
const PUBLIC_AUTH_METHODS = new Set([
  "client_secret_basic",
  "client_secret_post",
  "none",
]);

export type McpRegisterResult =
  | {
      body: {
        client_id: string;
        client_id_issued_at: number;
        client_name: string;
        client_uri?: string;
        grant_types: string[];
        redirect_uris: string[];
        response_types: string[];
        token_endpoint_auth_method: "none";
      };
      ok: true;
    }
  | {
      body: {
        error: "invalid_client_metadata" | "invalid_redirect_uri";
        error_description: string;
      };
      ok: false;
    };

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

/**
 * A name safe to show on the consent page: control and invisible formatting
 * characters (bidi overrides included) removed, whitespace collapsed, at most
 * 100 characters.
 */
export const sanitizeMcpClientName = (value: unknown): string => {
  if (typeof value !== "string") return "";

  return [
    ...value
      .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ]
    .slice(0, MAX_CLIENT_NAME_LENGTH)
    .join("")
    .trim();
};

const sanitizeClientUri = (value: unknown): string | undefined => {
  if (typeof value !== "string" || value.length > MAX_CLIENT_URI_LENGTH) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return undefined;
    }

    return url.href;
  } catch {
    return undefined;
  }
};

const fallbackName = (redirectUri: string): string => {
  try {
    return sanitizeMcpClientName(new URL(redirectUri).hostname) || "MCP client";
  } catch {
    return "MCP client";
  }
};

/**
 * RFC 7591 Dynamic Client Registration for public MCP clients. Every redirect
 * URI must pass {@link isRegistrableRedirectUri}. Server-only.
 */
export const registerMcpClient = async (
  c: Context<EnvVitNode>,
  metadata: unknown,
): Promise<McpRegisterResult> => {
  const invalid = (
    error: "invalid_client_metadata" | "invalid_redirect_uri",
    description: string,
  ): McpRegisterResult => ({
    body: { error, error_description: description },
    ok: false,
  });

  if (
    typeof metadata !== "object" ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return invalid("invalid_client_metadata", "Expected a JSON object.");
  }
  const body = metadata as Record<string, unknown>;

  const redirectUris = body.redirect_uris;
  if (
    !isStringArray(redirectUris) ||
    redirectUris.length === 0 ||
    redirectUris.length > MAX_REDIRECT_URIS
  ) {
    return invalid(
      "invalid_redirect_uri",
      `redirect_uris must list 1 to ${MAX_REDIRECT_URIS} URIs.`,
    );
  }
  const config = mcpConfigOf(c);
  const rejected = redirectUris.find(
    uri => !isRegistrableRedirectUri(uri, config),
  );
  if (rejected !== undefined) {
    return invalid(
      "invalid_redirect_uri",
      "This site does not accept that redirect URI. Loopback URIs and the redirect URIs its administrator allowed are accepted.",
    );
  }

  const authMethod = body.token_endpoint_auth_method;
  if (
    authMethod !== undefined &&
    (typeof authMethod !== "string" || !PUBLIC_AUTH_METHODS.has(authMethod))
  ) {
    return invalid(
      "invalid_client_metadata",
      'Only public clients are supported (token_endpoint_auth_method "none").',
    );
  }

  const grantTypes = body.grant_types;
  if (
    grantTypes !== undefined &&
    (!isStringArray(grantTypes) ||
      !grantTypes.includes("authorization_code") ||
      grantTypes.some(
        type => !(MCP_GRANT_TYPES as readonly string[]).includes(type),
      ))
  ) {
    return invalid(
      "invalid_client_metadata",
      "grant_types must be authorization_code, optionally with refresh_token.",
    );
  }

  const responseTypes = body.response_types;
  if (
    responseTypes !== undefined &&
    (!isStringArray(responseTypes) ||
      responseTypes.length === 0 ||
      responseTypes.some(type => type !== "code"))
  ) {
    return invalid(
      "invalid_client_metadata",
      'response_types may only contain "code".',
    );
  }

  const uniqueRedirectUris = [...new Set(redirectUris)];
  const name =
    sanitizeMcpClientName(body.client_name) ||
    fallbackName(uniqueRedirectUris[0]);
  const uri = sanitizeClientUri(body.client_uri);
  const clientId = randomBase64Url(24);
  const createdAt = new Date();

  await c
    .get("db")
    .insert(core_mcp_clients)
    .values({
      clientId,
      createdAt,
      name,
      redirectUris: uniqueRedirectUris,
      uri: uri ?? null,
    });

  return {
    body: {
      client_id: clientId,
      client_id_issued_at: Math.floor(createdAt.getTime() / 1000),
      client_name: name,
      ...(uri ? { client_uri: uri } : {}),
      grant_types: [...MCP_GRANT_TYPES],
      redirect_uris: uniqueRedirectUris,
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    ok: true,
  };
};
