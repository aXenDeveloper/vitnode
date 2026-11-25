/**
 * The scopes an MCP access token can carry. `read` runs tools that only read
 * (every `GET` route tool, and custom tools with `scope: "read"`); `write`
 * runs the rest. Neither implies the other.
 */
export const MCP_SCOPES = ["read", "write"] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

export const isMcpScope = (value: string): value is McpScope =>
  (MCP_SCOPES as readonly string[]).includes(value);

/**
 * Parses an OAuth `scope` parameter (space-separated). Returns `null` when it
 * names a scope VitNode does not know, the empty list for an empty value, and
 * every listed scope once, in {@link MCP_SCOPES} order.
 */
export const parseMcpScopes = (
  value: null | string | undefined,
): McpScope[] | null => {
  const requested = (value ?? "").split(" ").filter(Boolean);
  if (requested.some(scope => !isMcpScope(scope))) return null;

  return MCP_SCOPES.filter(scope => requested.includes(scope));
};

export const formatMcpScopes = (scopes: readonly McpScope[]): string =>
  MCP_SCOPES.filter(scope => scopes.includes(scope)).join(" ");
