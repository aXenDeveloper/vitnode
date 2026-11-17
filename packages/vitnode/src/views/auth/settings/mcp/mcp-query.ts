import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

/** What the MCP settings page reads: grantable tools and the member's tokens. */
export interface McpSettings {
  enabled: boolean;
  endpoint: string;
  maxLifetimeDays: number;
  plugins: {
    pluginId: string;
    tools: {
      annotations?: { readOnlyHint?: boolean; title?: string };
      description: string;
      name: string;
      requiresAdmin: boolean;
    }[];
  }[];
  tokens: McpTokenSummary[];
}

export interface McpTokenSummary {
  createdAt: Date | string;
  expiresAt: Date | string;
  id: number;
  label: string;
  lastUsedAt: Date | null | string;
  prefix: string;
  revokedAt: Date | null | string;
  status: "active" | "expired" | "revoked";
  tools: string[];
}

const MCP_REQUEST_ERROR = "McpRequestError";

/** A non-2xx answer from the MCP settings API. */
export class McpRequestError extends Error {
  constructor(status: number) {
    super(`The MCP settings API answered ${status}.`);
    this.name = MCP_REQUEST_ERROR;
    this.status = status;
  }

  readonly status: number;
}

export const fetchMcpSettings = async (): Promise<McpSettings> => {
  const [tools, tokens] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "mcp",
      path: "/tools",
    }),
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "mcp",
      path: "/tokens",
    }),
  ]);
  if (!tools.ok) throw new McpRequestError(tools.status);
  if (!tokens.ok) throw new McpRequestError(tokens.status);

  return { ...(await tools.json()), tokens: (await tokens.json()).tokens };
};

export const mcpSettingsQueryKey = (userId: number) =>
  ["mcp-settings", "user", userId] as const;

export const mcpSettingsQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    // The owner comes from the session cookie, on the server, on every call.
    queryFn: fetchMcpSettings,
    queryKey: mcpSettingsQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

/** The API's refusal codes for a new token. */
export type McpCreateTokenError =
  | "mcp_disabled"
  | "token_lifetime_too_long"
  | "tools_not_available";

export type McpCreateTokenResult =
  | { error: "unknown" | McpCreateTokenError }
  | { token: string; tokenInfo: McpTokenSummary };

export const createMcpToken = async (input: {
  expiresInDays: number;
  label: string;
  tools: string[];
}): Promise<McpCreateTokenResult> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "post",
    module: "mcp",
    path: "/tokens",
    args: { body: input },
  });
  if (response.status === 201) return await response.json();
  if (response.status === 400 || response.status === 404) {
    const body = await response.json();

    return { error: body.error as McpCreateTokenError };
  }

  return { error: "unknown" };
};

export const revokeMcpToken = async (id: number): Promise<boolean> => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "delete",
    module: "mcp",
    path: "/tokens/{id}",
    args: { params: { id } },
  });

  return response.ok;
};
