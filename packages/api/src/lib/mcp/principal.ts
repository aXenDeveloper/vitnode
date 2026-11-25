import type { McpScope } from "./scopes";

/** Who an authenticated MCP request acts for: a member, through one connection. */
export interface McpPrincipal {
  /** The OAuth client the member connected, as `core_mcp_clients.clientId`. */
  clientId: string;
  /** The connection (`core_mcp_grants.id`) the access token belongs to. */
  grantId: number;
  scopes: readonly McpScope[];
  userId: number;
}

/** What a tool call hands the request it runs a route tool through. */
export interface McpInternalCall {
  /** The caller's address, so the route sees the real client, not `127.0.0.1`. */
  ipAddress: string;
  /** `null` for a guest call (only when `mcp.guestAccess` is on). */
  principal: McpPrincipal | null;
}

// Keyed by the `Request` object itself: only code in this process can put a
// request in here, so a header or a cookie can never claim to be an MCP call.
const internalCalls = new WeakMap<Request, McpInternalCall>();

/**
 * Marks a request the MCP endpoint builds to run a route tool. The global
 * middleware then takes the member from `call.principal` instead of the
 * session cookie, and the CSRF check and rate limiter let it through - the
 * outer `/mcp` request was already checked and counted.
 */
export const markMcpInternalRequest = (
  request: Request,
  call: McpInternalCall,
): Request => {
  internalCalls.set(request, call);

  return request;
};

/** The MCP call a request was built for, or `undefined` for every other request. */
export const mcpInternalCallOf = (
  request: Request,
): McpInternalCall | undefined => internalCalls.get(request);
