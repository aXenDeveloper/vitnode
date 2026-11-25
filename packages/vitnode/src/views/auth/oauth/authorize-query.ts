import type { McpScope } from "@vitnode/api/lib/mcp/scopes";

import { queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

import type { OAuthAuthorizeSearch } from "./authorize-search";

/** Why the API refused an authorization request, e.g. `invalid_client`. */
export type OAuthAuthorizeError = string;

export interface OAuthAuthorizeRequest {
  client: { clientId: string; name: string; uri: null | string };
  redirectHost: string;
  redirectUri: string;
  scopes: McpScope[];
}

/**
 * What the consent page can show. A request that is invalid, or a site with
 * MCP off, is an answer rather than a failure - only a network or server error
 * rejects.
 */
export type OAuthAuthorizeCheck =
  | { error: OAuthAuthorizeError; status: "invalid" }
  | { request: OAuthAuthorizeRequest; status: "ok" }
  | { status: "disabled" };

export class OAuthAuthorizeRequestError extends Error {
  constructor(status: number) {
    super(`The MCP authorize API answered ${status}.`);
    this.name = "OAuthAuthorizeRequestError";
    this.status = status;
  }

  readonly status: number;
}

export const fetchOAuthAuthorize = async (
  search: OAuthAuthorizeSearch,
): Promise<OAuthAuthorizeCheck> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: search },
    method: "get",
    module: "mcp",
    path: "/authorize",
  });

  if (response.status === 200) {
    return { request: await response.json(), status: "ok" };
  }
  if (response.status === 400) {
    const { error } = await response.json();

    return { error, status: "invalid" };
  }
  if (response.status === 404) return { status: "disabled" };

  throw new OAuthAuthorizeRequestError(response.status);
};

export const oauthAuthorizeQueryOptions = ({
  search,
  userId,
}: {
  search: OAuthAuthorizeSearch;
  userId: number;
}) =>
  queryOptions({
    queryFn: async () => await fetchOAuthAuthorize(search),
    queryKey: ["mcp", "authorize", userId, search] as const,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

export type OAuthAuthorizeAnswer =
  | { check: Exclude<OAuthAuthorizeCheck, { status: "ok" }> }
  | { failed: true }
  | { redirectTo: string };

/**
 * Sends the member's answer. Approving issues a code for `scopes`; either way
 * the result names the URL to send the browser to - with a full-page
 * navigation, since it is the client's own redirect URI (a loopback address or
 * a custom scheme), not a page of this app.
 */
export const answerOAuthAuthorize = async ({
  approve,
  scopes,
  search,
}: {
  approve: boolean;
  scopes: McpScope[];
  search: OAuthAuthorizeSearch;
}): Promise<OAuthAuthorizeAnswer> => {
  try {
    const response = await fetcher({
      plugin: manifest.id,
      args: {
        body: { ...search, approve, scopes: approve ? scopes : undefined },
      },
      method: "post",
      module: "mcp",
      path: "/authorize",
    });

    if (response.status === 200) {
      const { redirectTo } = await response.json();

      return { redirectTo };
    }
    if (response.status === 400) {
      const { error } = await response.json();

      return { check: { error, status: "invalid" } };
    }
    if (response.status === 404) return { check: { status: "disabled" } };

    return { failed: true };
  } catch {
    return { failed: true };
  }
};
