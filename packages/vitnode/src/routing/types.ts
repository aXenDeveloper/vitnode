/**
 * Where a plugin route mounts in the application.
 *
 * One member, on purpose. Stage 5 is about public pages: the AdminCP has its own
 * layout, its own staff permissions and its own breadcrumbs, and none of that is
 * decided here. Adding `"admin"` later is a one-line change plus whatever
 * interprets it - which is exactly the point of keeping the list here rather than
 * letting every route invent its own string.
 */
export type PluginRouteArea = "main";

/** Every area a route may declare. */
export const PLUGIN_ROUTE_AREAS: PluginRouteArea[] = ["main"];

/**
 * Separates a plugin id from a route id. Not legal inside either half.
 *
 * The same separator `framework/plugin-routes` keys its generated module
 * registry by, so a manifest entry's `id` *is* the key that registry is looked
 * up with. Two layers, one identifier, and nothing has to translate between
 * them.
 */
export const PLUGIN_ROUTE_ID_SEPARATOR = ":";

/** One parsed segment of a canonical VitNode route path. */
export type PluginRouteSegment =
  { kind: "param"; name: string } | { kind: "static"; value: string };

/**
 * A page route contributed by a plugin, as the plugin declares it.
 *
 * Deliberately four fields, two of which are the two `framework/plugin-routes`
 * already reads - so one list in a plugin's `routes/manifest.ts` serves both:
 * the build tool takes `id` and `entry` and generates a lazy import, and this
 * layer takes `path` and `area` and decides what URL that import answers.
 *
 * Everything else a page needs - its data, its metadata, its cache policy, who
 * may see it - is either the component's business or a question this prototype
 * has not earned an answer to yet.
 */
export interface PluginRouteDefinition {
  /** Defaults to `"main"`. */
  area?: PluginRouteArea;
  /**
   * Package export subpath of the module that renders this route, e.g.
   * `"routes/example-page"`, imported as
   * `"@vitnode/example/routes/example-page"`.
   *
   * A subpath rather than a full specifier, because the plugin id is already on
   * the record; a subpath rather than a file path, so a plugin can move the
   * implementation inside its `dist` without breaking every app that installs
   * it; extensionless, because the plugin's export map adds the extension.
   */
  entry: string;
  /**
   * Stable identifier, unique within the plugin. It survives a path change -
   * that is what makes it worth having - so name it after the page, not the URL.
   */
  id: string;
  /**
   * Canonical VitNode path: `/blog`, `/blog/:slug`, `/blog/:slug/comments`.
   *
   * Neither Next's `[slug]` nor TanStack's `$slug`. See `./path` for the
   * conversions, and for the shapes this prototype rejects rather than guesses
   * at.
   */
  path: string;
}

/** One route in a built manifest: validated, normalised and parsed. */
export interface PluginRoute {
  area: PluginRouteArea;
  entry: string;
  /**
   * Globally unique, `"<pluginId>:<routeId>"` - and the key
   * `framework/plugin-routes` registers the route's module loader under.
   */
  id: string;
  /** Canonical path, normalised (no trailing slash). */
  path: string;
  pluginId: string;
  /** The plugin-local half of {@link PluginRoute.id}, as declared. */
  routeId: string;
  /** `path`, already parsed - so nothing downstream has to parse it again. */
  segments: PluginRouteSegment[];
}

/**
 * Every plugin route in an application, deterministically ordered.
 *
 * A plain array rather than a wrapper object: it is a list of routes, and a
 * wrapper would only be somewhere to put the fields this stage was asked not to
 * invent.
 */
export type PluginRouteManifest = PluginRoute[];

/**
 * The part of a registered plugin the manifest reads.
 *
 * Structural, not `BuildPluginReturn`: that type reaches the AdminCP nav and the
 * Content Engine, which reach React and Next, and this module has to stay
 * loadable anywhere. A `BuildPluginReturn` satisfies this shape as it is.
 */
export interface PluginRouteSource {
  pluginId: string;
  routes?: PluginRouteDefinition[];
}
