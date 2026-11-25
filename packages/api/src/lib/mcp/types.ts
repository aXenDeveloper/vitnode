import type { ApiPluginRegistry } from "../fetcher/registry";
import type { McpConfigBase } from "./config";

/**
 * Every plugin id the app registered: core's `"@vitnode/core"`, plus one per
 * plugin in the app's generated `src/api-registry.gen.ts`.
 */
export type McpPluginId = Extract<keyof ApiPluginRegistry, string>;

type McpToolsOf<Entry> = Entry extends { mcpTools: infer Tools extends string }
  ? Tools
  : never;

/**
 * Every MCP tool the registered plugins offer, as `"<pluginId>:<tool>"` -
 * routes built with `mcp` and custom tools from `defineMcpTool` - e.g.
 * `"@vitnode/forum:forum.stats.forums.get"`.
 */
export type McpToolKey = {
  [Id in McpPluginId]: `${Id}:${McpToolsOf<ApiPluginRegistry[Id]>}`;
}[McpPluginId];

/**
 * The API config's `mcp`, typed against the installed plugins: `plugins` and
 * `disabledTools` only accept ids and tools that exist. See
 * {@link McpConfigBase} for every option.
 */
export type McpConfig = McpConfigBase<McpPluginId, McpToolKey>;
