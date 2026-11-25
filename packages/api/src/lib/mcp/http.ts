import type { ResolvedMcpConfig } from "./config";

import { CONFIG } from "../config";
import { MCP_MOUNT_PATH, mcpPublicOrigin } from "./urls";

/** The newest MCP protocol version the endpoint speaks. */
export const MCP_LATEST_PROTOCOL_VERSION = "2025-11-25";

/** Every MCP protocol version the endpoint accepts, newest first. */
export const MCP_PROTOCOL_VERSIONS = [
  MCP_LATEST_PROTOCOL_VERSION,
  "2025-06-18",
  "2025-03-26",
] as const;

/** Assumed when a request carries no `MCP-Protocol-Version` header. */
export const MCP_DEFAULT_PROTOCOL_VERSION = "2025-03-26";

export const isMcpProtocolVersion = (value: string): boolean =>
  (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(value);

/** `${apiBasePath}/mcp`, the endpoint's own path. */
export const mcpEndpointPath = (apiBasePath: string): string =>
  `${apiBasePath === "/" ? "" : apiBasePath.replace(/\/$/, "")}${MCP_MOUNT_PATH}`;

/** Whether a request path is the MCP endpoint or below it (`/api/mcp/oauth/token`). */
export const isMcpPath = (path: string, apiBasePath: string): boolean => {
  const endpoint = mcpEndpointPath(apiBasePath);

  return path === endpoint || path.startsWith(`${endpoint}/`);
};

/**
 * The origins a browser may call the MCP endpoint from: the API's public
 * origin, `VITNODE_API_URL`, `VITNODE_WEB_URL` and `mcp.allowedOrigins`.
 * Never the request's own `Host`, which a DNS-rebinding page controls.
 */
export const mcpAllowedOrigins = (
  config: Pick<ResolvedMcpConfig, "allowedOrigins">,
): ReadonlySet<string> =>
  new Set([
    CONFIG.api.origin,
    CONFIG.web.origin,
    mcpPublicOrigin(),
    ...config.allowedOrigins.map(origin => origin.replace(/\/$/, "")),
  ]);

/** Request headers an MCP client sends cross-origin. */
export const MCP_CORS_ALLOW_HEADERS = [
  "Authorization",
  "Content-Type",
  "MCP-Protocol-Version",
  "Mcp-Session-Id",
] as const;

/** Response headers an MCP client reads cross-origin. */
export const MCP_CORS_EXPOSE_HEADERS = [
  "WWW-Authenticate",
  "MCP-Protocol-Version",
] as const;
