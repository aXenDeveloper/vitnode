import { CONFIG } from "../config";

/** Where the MCP endpoint is mounted, below the API's base path (`/api/mcp`). */
export const MCP_MOUNT_PATH = "/mcp";

/** The well-known documents a client discovers authorization through. */
export const MCP_WELL_KNOWN = {
  authorizationServer: "oauth-authorization-server",
  protectedResource: "oauth-protected-resource",
} as const;

export interface McpUrls {
  authorizationServerMetadata: string;
  /** The member-facing consent page in the web app. */
  authorize: string;
  /** The issuer: the MCP endpoint itself, `https://site/api/mcp`. */
  issuer: string;
  protectedResourceMetadata: string;
  register: string;
  /** The MCP endpoint, and the `resource` (audience) every token is bound to. */
  resource: string;
  revoke: string;
  token: string;
}

/**
 * The public origin the API is reached at: `VITNODE_API_URL` when the API runs
 * on its own origin, else `VITNODE_WEB_URL` (the API is mounted inside the web
 * app). Never the request's `Host`, which a client chooses.
 */
export const mcpPublicOrigin = (): string =>
  process.env.VITNODE_API_URL ? CONFIG.api.origin : CONFIG.web.origin;

/**
 * Every URL a client needs. `apiBasePath` is the base path the host app gave
 * the API (`/api`, or `""` at the root), as `c.get("core").mcp.apiBasePath`
 * holds it. Server-only.
 */
export const mcpUrls = ({ apiBasePath }: { apiBasePath: string }): McpUrls => {
  const origin = mcpPublicOrigin();
  const base = apiBasePath === "/" ? "" : apiBasePath.replace(/\/$/, "");
  const resource = `${origin}${base}${MCP_MOUNT_PATH}`;
  const webOrigin = CONFIG.web.origin;

  return {
    authorize: `${webOrigin}/oauth/authorize`,
    authorizationServerMetadata: `${origin}/.well-known/${MCP_WELL_KNOWN.authorizationServer}${base}${MCP_MOUNT_PATH}`,
    issuer: resource,
    protectedResourceMetadata: `${resource}/.well-known/${MCP_WELL_KNOWN.protectedResource}`,
    register: `${resource}/oauth/register`,
    resource,
    revoke: `${resource}/oauth/revoke`,
    token: `${resource}/oauth/token`,
  };
};
