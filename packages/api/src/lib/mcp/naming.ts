/**
 * A tool's name inside its plugin: lowercase letters and digits, in groups
 * joined by `.`, `_` or `-` (`forum.stats.forums.get`).
 */
export const MCP_LOCAL_TOOL_NAME = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

/** A tool's name on the wire, as MCP clients see it (`forum_forum_stats_forums_get`). */
export const MCP_WIRE_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

type Segments<S extends string> = S extends `${infer Head}/${infer Rest}`
  ? [...(Head extends "" ? [] : [Head]), ...Segments<Rest>]
  : S extends ""
    ? []
    : [S];

type StripBraces<S extends string> =
  S extends `${infer Before}{${infer Param}}${infer After}`
    ? `${Before}${Param}${StripBraces<After>}`
    : S;

type JoinDots<T extends readonly string[]> = T extends readonly [
  infer Head extends string,
]
  ? Head
  : T extends readonly [
        infer Head extends string,
        ...infer Rest extends readonly string[],
      ]
    ? `${Head}.${JoinDots<Rest>}`
    : "";

/**
 * The default local name of a route tool, at the type level: the module path's
 * segments, the route path's segments with `{param}` read as `param`, then the
 * lowercase method, joined by `.` - `forum` + `GET /stats/forums` is
 * `forum.stats.forums.get`. Mirrors {@link mcpRouteToolName}.
 */
export type McpRouteToolName<
  ModulePath extends string,
  Path extends string,
  Method extends string,
> = Lowercase<
  JoinDots<
    [...Segments<ModulePath>, ...Segments<StripBraces<Path>>, Lowercase<Method>]
  >
>;

/** The default local name of a route tool; see {@link McpRouteToolName}. */
export const mcpRouteToolName = ({
  method,
  modulePath,
  path,
}: {
  method: string;
  /** The module path below the plugin, `admin/ai` for an `ai` module in `admin`. */
  modulePath: string;
  path: string;
}): string =>
  [
    ...modulePath.split("/"),
    ...path.replace(/[{}]/g, "").split("/"),
    method.toLowerCase(),
  ]
    .filter(Boolean)
    .join(".")
    .toLowerCase();

/**
 * A plugin id as a wire-name prefix: `@vitnode/` dropped, every other character
 * that is not a letter or digit turned into `_` (`@vitnode/forum` → `forum`,
 * `@acme/shop` → `_acme_shop`).
 */
export const mcpPluginSlug = (pluginId: string): string =>
  pluginId.replace(/^@vitnode\//, "").replace(/[^a-zA-Z0-9]/g, "_");

/** `${slug}_${localName}`, with `.` and `-` turned into `_`. Not checked; see {@link MCP_WIRE_TOOL_NAME}. */
export const mcpWireToolName = (pluginId: string, localName: string): string =>
  `${mcpPluginSlug(pluginId)}_${localName.replace(/[.-]/g, "_")}`;
