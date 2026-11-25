import type { McpScope } from "@vitnode/api/lib/mcp/scopes";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

/** One AI client the member connected over MCP. */
export interface McpConnection {
  client: { name: string; uri: null | string };
  createdAt: string;
  id: number;
  lastUsedAt: string;
  scopes: McpScope[];
}

/** How the list is fetched. See {@link connectedAppsQueryOptions}. */
export type ConnectedAppsFetcher = () => Promise<McpConnection[]>;

export class ConnectedAppsRequestError extends Error {
  constructor(status: number) {
    super(`The MCP connections API answered ${status}.`);
    this.name = "ConnectedAppsRequestError";
    this.status = status;
  }

  readonly status: number;
}

export const fetchConnectedApps: ConnectedAppsFetcher = async () => {
  const response = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "mcp",
    path: "/connections",
  });

  if (response.status !== 200) {
    throw new ConnectedAppsRequestError(response.status);
  }

  const { items } = await response.json();

  return items;
};

export const connectedAppsQueryKey = (userId: number) =>
  ["mcp", "connections", userId] as const;

export const connectedAppsQueryOptions = ({ userId }: { userId: number }) =>
  queryOptions({
    // The owner comes from the session cookie on the server; `userId` only
    // keeps two accounts on one browser from sharing a cache entry.
    queryFn: async () => await fetchConnectedApps(),
    queryKey: connectedAppsQueryKey(userId),
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

/**
 * Disconnects one MCP client. `true` when it is gone - including when it was
 * already gone (`404`), since the list is then out of date either way.
 */
export const disconnectConnectedApp = async (id: number): Promise<boolean> => {
  try {
    const response = await fetcher({
      plugin: manifest.id,
      args: { params: { id: String(id) } },
      method: "delete",
      module: "mcp",
      path: "/connections/{id}",
    });

    return response.status === 200 || response.status === 404;
  } catch {
    return false;
  }
};
