/**
 * The API config's `mcp`: exposes the installation to AI clients (Claude,
 * ChatGPT, Cursor...) over the Model Context Protocol at `/api/mcp`.
 *
 * Off unless `enabled` is `true`. Members connect a client with OAuth 2.1
 * (authorization code + PKCE): they sign in, approve the client on a consent
 * page, and the client acts for them with short-lived tokens bound to this
 * endpoint. A token never acts as an admin or a moderator.
 *
 * `McpPluginId` and `McpToolKey` are filled in by `./types` from the plugin
 * registry, so `plugins` and `disabledTools` only accept what is installed.
 */
export interface McpConfigBase<
  PluginId extends string,
  ToolKey extends string,
> {
  /**
   * Origins a browser-based MCP client may call `/api/mcp` from. Requests with
   * any other `Origin` header are refused (`403`), which is what stops a web
   * page from driving the endpoint through a member's browser. Requests with no
   * `Origin` (desktop and server-side clients) are unaffected. The API's own
   * origin and `VITNODE_WEB_URL` are always allowed.
   */
  allowedOrigins?: readonly string[];
  /** OAuth settings for connecting clients. */
  auth?: {
    /**
     * Access token lifetime in milliseconds, from 1 minute to 1 hour. Defaults
     * to 15 minutes.
     */
    accessTokenTtl?: number;
    /**
     * Exact redirect URIs remote clients may register, e.g.
     * `"https://claude.ai/api/mcp/auth_callback"`. A client registering any
     * other non-loopback URI is refused, so a stranger cannot put the consent
     * page in front of members with their own callback. Defaults to none.
     */
    allowedRedirectUris?: readonly string[];
    /**
     * Lets clients register `http://127.0.0.1:<port>/...` and
     * `http://localhost:<port>/...` redirect URIs (RFC 8252), which desktop
     * clients such as Claude Code and Cursor use. Defaults to `true`.
     */
    allowLoopbackRedirects?: boolean;
    /**
     * Refresh token lifetime in milliseconds, from 1 hour to 90 days. Each
     * refresh rotates it; reusing an old one revokes the connection. Defaults
     * to 30 days.
     */
    refreshTokenTtl?: number;
  };
  /**
   * Tools that are never offered, as `"<pluginId>:<tool>"` - e.g.
   * `"@vitnode/forum:forum.topics.get"`.
   */
  disabledTools?: readonly ToolKey[];
  /** Serves `/api/mcp` and its OAuth endpoints. Defaults to `false`. */
  enabled?: boolean;
  /**
   * Lets clients call read tools without a token, as a guest sees the site.
   * Write tools always need a member. Defaults to `false`: every call needs a
   * token.
   */
  guestAccess?: boolean;
  /**
   * Text sent to clients when they connect, telling the model what this site is
   * and how to use its tools. Defaults to none.
   */
  instructions?: string;
  /**
   * The plugins whose tools are offered. Defaults to every installed plugin,
   * core included (`"@vitnode/core"`).
   */
  plugins?: readonly PluginId[];
}

/** Defaults applied to {@link McpConfigBase}, in milliseconds. */
export const MCP_DEFAULTS = {
  accessTokenTtl: 15 * 60_000,
  authorizationCodeTtl: 60_000,
  refreshTokenTtl: 30 * 24 * 60 * 60_000,
} as const;

export const MCP_LIMITS = {
  accessTokenTtl: { max: 60 * 60_000, min: 60_000 },
  refreshTokenTtl: { max: 90 * 24 * 60 * 60_000, min: 60 * 60_000 },
} as const;

/** {@link McpConfigBase} with every default applied. */
export interface ResolvedMcpConfig {
  accessTokenTtl: number;
  allowedOrigins: readonly string[];
  allowedRedirectUris: readonly string[];
  allowLoopbackRedirects: boolean;
  /** The base path the host app mounted the API at (`/api`), or `""`. */
  apiBasePath: string;
  disabledTools: ReadonlySet<string>;
  enabled: boolean;
  guestAccess: boolean;
  instructions: string | undefined;
  /** `null` for every installed plugin. */
  plugins: null | ReadonlySet<string>;
  refreshTokenTtl: number;
}

const clamp = (
  value: number | undefined,
  fallback: number,
  { max, min }: { max: number; min: number },
): number =>
  value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.min(max, Math.max(min, Math.round(value)));

export const resolveMcpConfig = (
  config: McpConfigBase<string, string> | undefined,
  apiBasePath: string,
): ResolvedMcpConfig => ({
  apiBasePath: apiBasePath === "/" ? "" : apiBasePath.replace(/\/$/, ""),
  accessTokenTtl: clamp(
    config?.auth?.accessTokenTtl,
    MCP_DEFAULTS.accessTokenTtl,
    MCP_LIMITS.accessTokenTtl,
  ),
  allowedOrigins: config?.allowedOrigins ?? [],
  allowedRedirectUris: config?.auth?.allowedRedirectUris ?? [],
  allowLoopbackRedirects: config?.auth?.allowLoopbackRedirects ?? true,
  disabledTools: new Set(config?.disabledTools ?? []),
  enabled: config?.enabled ?? false,
  guestAccess: config?.guestAccess ?? false,
  instructions: config?.instructions,
  plugins: config?.plugins ? new Set(config.plugins) : null,
  refreshTokenTtl: clamp(
    config?.auth?.refreshTokenTtl,
    MCP_DEFAULTS.refreshTokenTtl,
    MCP_LIMITS.refreshTokenTtl,
  ),
});
