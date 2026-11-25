import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { EnvVitNode } from "@/middlewares/global.middleware";

import { MCP_AUTHORIZE_ERRORS, mcpConfigOf } from "@/lib/mcp/oauth/authorize";
import { MCP_SCOPES } from "@/lib/mcp/scopes";

const param = (example: string) =>
  z.string().max(4096).optional().openapi({ example });

/** The authorization request's own parameters, as the client sent them. */
export const zodMcpAuthorizeParams = z.object({
  client_id: param("Xb3k9..."),
  redirect_uri: param("http://127.0.0.1:33418/callback"),
  response_type: param("code"),
  code_challenge: param("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),
  code_challenge_method: param("S256"),
  state: param("af0ifjsldkj"),
  scope: param("read write"),
  resource: param("https://example.com/api/mcp"),
});

export const zodMcpScope = z.enum(MCP_SCOPES);

export const zodMcpErrorResponse = (
  errors: readonly [string, ...string[]],
  description: string,
) => ({
  content: {
    "application/json": {
      schema: z.object({ error: z.enum(errors) }),
    },
  },
  description,
});

export const MCP_AUTHORIZE_ERROR_RESPONSES = {
  400: zodMcpErrorResponse(
    MCP_AUTHORIZE_ERRORS,
    "The authorization request is invalid; nothing may be sent to its redirect URI",
  ),
  401: { description: "Not signed in" },
  404: zodMcpErrorResponse(["mcp_disabled"], "MCP is not enabled on this site"),
} as const;

/**
 * The signed-in member, after checking MCP is on. `null` (answer `404
 * mcp_disabled`) when it is off. Throws `401` for a guest - a suspended
 * member is a guest here too.
 */
export const requireMcpMember = (
  c: Context<EnvVitNode>,
): NonNullable<EnvVitNode["Variables"]["user"]> | null => {
  if (!mcpConfigOf(c).enabled) return null;

  const user = c.get("user");
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });

  return user;
};
