import type { Context } from "hono";

import { z } from "@hono/zod-openapi";

import type { McpScope } from "@/lib/mcp/scopes";
import type { EnvVitNode } from "@/middlewares/global.middleware";

import { buildRoute } from "@/builders";
import {
  completeMcpAuthorization,
  type McpAuthorizeError,
  validateMcpAuthorizeRequest,
  type ValidMcpAuthorizeRequest,
} from "@/lib/mcp/oauth/authorize";

import {
  MCP_AUTHORIZE_ERROR_RESPONSES,
  requireMcpMember,
  zodMcpAuthorizeParams,
  zodMcpScope,
} from "../lib/schema";

type AuthorizeParams = z.infer<typeof zodMcpAuthorizeParams>;

const validate = async (
  c: Context<EnvVitNode>,
  params: AuthorizeParams,
): Promise<
  { error: McpAuthorizeError } | { request: ValidMcpAuthorizeRequest }
> => {
  if (!params.client_id) return { error: "invalid_client" };
  if (!params.redirect_uri) return { error: "invalid_redirect_uri" };

  const result = await validateMcpAuthorizeRequest(c, {
    client_id: params.client_id,
    code_challenge: params.code_challenge ?? "",
    code_challenge_method: params.code_challenge_method ?? "",
    redirect_uri: params.redirect_uri,
    resource: params.resource,
    response_type: params.response_type ?? "",
    scope: params.scope,
    state: params.state,
  });

  return result.ok ? { request: result.request } : { error: result.error };
};

// `host` keeps a loopback port, so "127.0.0.1:33418" reads as local; a
// native app's private scheme has no host, so its scheme stands in.
const redirectHostOf = (redirectUri: string): string => {
  const url = new URL(redirectUri);

  return url.host || url.protocol.replace(/:$/, "");
};

export const showMcpAuthorizeRoute = buildRoute({
  route: {
    method: "get",
    description:
      "Check an MCP client's authorization request for the consent page, without issuing anything: which client asks, where it returns, and which scopes it wants.",
    path: "/authorize",
    request: { query: zodMcpAuthorizeParams },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              client: z.object({
                clientId: z.string(),
                name: z.string(),
                uri: z.string().nullable(),
              }),
              redirectUri: z.string(),
              redirectHost: z.string(),
              scopes: z.array(zodMcpScope),
            }),
          },
        },
        description: "The request is valid; show the consent page",
      },
      ...MCP_AUTHORIZE_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    if (!requireMcpMember(c)) {
      return c.json({ error: "mcp_disabled" as const }, 404);
    }

    const result = await validate(c, c.req.valid("query"));
    if ("error" in result) return c.json({ error: result.error }, 400);

    const { client, redirectUri, scopes } = result.request;

    return c.json(
      {
        client: {
          clientId: client.clientId,
          name: client.name,
          uri: client.uri,
        },
        redirectUri,
        redirectHost: redirectHostOf(redirectUri),
        scopes,
      },
      200,
    );
  },
});

export const approveMcpAuthorizeRoute = buildRoute({
  route: {
    method: "post",
    description:
      "Answer an MCP client's authorization request as the signed-in member. Approving issues a single-use code for the scopes chosen; either way the response says where to send the browser.",
    path: "/authorize",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodMcpAuthorizeParams.extend({
              approve: z.boolean(),
              scopes: z.array(zodMcpScope).max(2).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ redirectTo: z.string() }),
          },
        },
        description:
          "Send the browser here: the client's redirect URI with a code, or with error=access_denied",
      },
      ...MCP_AUTHORIZE_ERROR_RESPONSES,
    },
  },
  handler: async c => {
    const user = requireMcpMember(c);
    if (!user) return c.json({ error: "mcp_disabled" as const }, 404);

    const { approve, scopes, ...params } = c.req.valid("json");
    const result = await validate(c, params);
    if ("error" in result) return c.json({ error: result.error }, 400);

    let approvedScopes: McpScope[] | null = null;
    if (approve) {
      const chosen = [...new Set(scopes ?? [])];
      if (
        chosen.length === 0 ||
        chosen.some(scope => !result.request.scopes.includes(scope))
      ) {
        return c.json({ error: "invalid_scope" as const }, 400);
      }
      approvedScopes = chosen;
    }

    const redirectTo = await completeMcpAuthorization(c, {
      approvedScopes,
      request: result.request,
      userId: user.id,
    });

    return c.json({ redirectTo }, 200);
  },
});
