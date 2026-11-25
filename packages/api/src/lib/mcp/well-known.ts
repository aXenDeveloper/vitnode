import { MCP_MOUNT_PATH, MCP_WELL_KNOWN } from "./urls";

const TYPES = new Set<string>(Object.values(MCP_WELL_KNOWN));

/**
 * Maps an origin-root discovery request onto the MCP endpoint's own copy.
 *
 * MCP clients look for `/.well-known/oauth-authorization-server/api/mcp` and
 * `/.well-known/oauth-protected-resource/api/mcp` (RFC 8414 §3.1, RFC 9728
 * §3.1) at the root of the origin, outside the API's base path. The host app
 * calls this before routing: for those two paths (or the bare
 * `/.well-known/<type>`) it returns a request for
 * `${apiBasePath}/mcp/.well-known/<type>` to hand to the API app; for anything
 * else, `null`. GET and HEAD only. Universal.
 *
 * @example
 * ```ts
 * import { mcpWellKnownRequest } from "@vitnode/api/lib/mcp/well-known";
 *
 * serve({
 *   fetch: (request, env) =>
 *     app.fetch(mcpWellKnownRequest(request, { apiBasePath: "/api" }) ?? request, env),
 * });
 * ```
 */
export const mcpWellKnownRequest = (
  request: Request,
  options: {
    /** The base path the API is mounted at. Defaults to `"/api"`. */
    apiBasePath?: string;
  } = {},
): null | Request => {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const match = /^\/\.well-known\/([a-z-]+)(\/.*)?$/.exec(url.pathname);
  if (!match || !TYPES.has(match[1])) return null;

  const raw = options.apiBasePath ?? "/api";
  const base = raw === "/" ? "" : raw.replace(/\/$/, "");
  const suffix = match[2] ?? "";
  if (suffix !== "" && suffix !== `${base}${MCP_MOUNT_PATH}`) return null;

  const target = new URL(
    `${base}${MCP_MOUNT_PATH}/.well-known/${match[1]}`,
    url.origin,
  );

  return new Request(target, {
    headers: request.headers,
    method: request.method,
    signal: request.signal,
  });
};
