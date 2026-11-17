import { z } from "@hono/zod-openapi";

/** The largest label a token takes. */
export const MCP_TOKEN_LABEL_MAX_LENGTH = 100;

export const zodMcpTokenSummary = z.object({
  createdAt: z.date(),
  expiresAt: z.date(),
  id: z.number().int(),
  label: z.string(),
  lastUsedAt: z.date().nullable(),
  /** The token's first characters, to tell tokens apart. */
  prefix: z.string(),
  revokedAt: z.date().nullable(),
  status: z.enum(["active", "expired", "revoked"]),
  tools: z.array(z.string()),
});

export const zodMcpToolSummary = z.object({
  annotations: z
    .object({
      destructiveHint: z.boolean().optional(),
      idempotentHint: z.boolean().optional(),
      openWorldHint: z.boolean().optional(),
      readOnlyHint: z.boolean().optional(),
      title: z.string().optional(),
    })
    .optional(),
  description: z.string(),
  name: z.string(),
  requiresAdmin: z.boolean(),
});

export const zodMcpError = z.object({
  error: z.enum([
    "mcp_disabled",
    "token_lifetime_too_long",
    "token_not_found",
    "tools_not_available",
  ]),
  /** For `tools_not_available`: the requested tools this member may not grant. */
  tools: z.array(z.string()).optional(),
});

export const mcpTokenStatusOf = (token: {
  expiresAt: Date;
  revokedAt: Date | null;
}): "active" | "expired" | "revoked" =>
  token.revokedAt
    ? "revoked"
    : token.expiresAt.getTime() <= Date.now()
      ? "expired"
      : "active";
