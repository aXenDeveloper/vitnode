/**
 * Where a plugin route mounts in the application.
 *
 * One member, on purpose, and Stage 11 audited that decision rather than
 * inheriting it. The legacy route-copying pipeline
 * (`scripts/prepare-plugins-files.ts`) knew three destinations - `main`, `admin`
 * and `blank` - and the only one a plugin has ever shipped a public page into is
 * `main`. `admin` is the AdminCP, which has its own layout, its own second
 * session and its own staff permissions, and moves in Stage 12; `blank` is a
 * page rendered without the site chrome, used once by a core test page and by no
 * plugin, so there is nothing to preserve and no way to get it wrong later - the
 * shell a route renders in is chosen by which route it is mounted under, and
 * adding a member here is what a second shell would cost.
 *
 * Keeping the list *here* rather than letting every route invent its own string
 * is the point: an area is a statement about layout, and a layout is a parent.
 */
export type PluginRouteArea = "main";

/** Every area a route may declare. */
export const PLUGIN_ROUTE_AREAS: PluginRouteArea[] = ["main"];

/**
 * What a route *is* in the route tree, as opposed to where it is.
 *
 * Two members, because a plugin with more than one page has exactly one thing
 * the flat prototype could not express: a frame around several of them. Core's
 * own settings screens - which reach an application through the same copying
 * pipeline a plugin's pages do - are a `layout.tsx` with an index page and three
 * siblings under it, and rebuilding that as four independent pages means four
 * copies of the frame and four chances for them to drift.
 *
 * - `page` claims a URL and renders it. The default, and what every route the
 *   prototype could describe is.
 * - `layout` claims **no URL of its own**. It renders a frame around its
 *   children and is only ever reached through one of them, which is why two
 *   layouts may not sit at the same path and why a layout with no children is
 *   rejected: it would be a route nothing can ever match.
 *
 * A third kind for a *pathless* group - Next's `(group)` folders - is
 * deliberately absent. No plugin has ever needed one, and a layout that adds no
 * segment is rejected with a message saying so rather than half-supported.
 */
export type PluginRouteKind = "layout" | "page";

/** Every kind a route may declare. */
export const PLUGIN_ROUTE_KINDS: PluginRouteKind[] = ["layout", "page"];

/**
 * Who a route is offered to - a **navigation** rule, and nothing more.
 *
 * This is not, and may never become, the security boundary. Every private read
 * is authorized by Hono on the server, from the session cookie, in the route's
 * own handler; a visitor who edits their cached session in devtools gets a page
 * shell and an API that still refuses them. What this decides is whether a
 * browser is sent somewhere else *before* the page renders, which is the
 * difference between a signed-out visitor seeing a flash of a private page and
 * never receiving a byte of it.
 *
 * It is on the manifest rather than in the route module for one reason, and it
 * is the whole argument for the split: the guard runs in `beforeLoad`, which is
 * *before* the module's chunk is fetched. A requirement that lived in the module
 * could only be read by downloading the page it was meant to withhold.
 *
 * - `authenticated` - a signed-in visitor, or a redirect to the login page
 *   carrying where they were going.
 * - `guest` - a signed-out visitor. A signed-in one is sent to their
 *   destination instead, which is what `/login` and `/register` do.
 *
 * Permissions are deliberately absent. The AdminCP's staff permission model is
 * Stage 12's, and moderator semantics are a hardcoded `false` in the session API
 * today - a route requirement written against either would read as enforcement
 * while being a constant.
 */
export type PluginRouteRequirement = "authenticated" | "guest";

/** Every requirement a route may declare. */
export const PLUGIN_ROUTE_REQUIREMENTS: PluginRouteRequirement[] = [
  "authenticated",
  "guest",
];

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
 * Eight fields, four of which are optional and default to "the simple case", so
 * the prototype's declaration still says exactly what it used to:
 *
 *     { entry: "routes/example-page", id: "example-page", path: "/example" }
 *
 * Every field here is **data**: serialisable, deterministic, meaningful in a
 * Node process with no framework loaded, and free of React, TanStack Router and
 * Next.js. That is not an aesthetic rule - this list is read while a Next.js app
 * builds, while a TanStack Start app builds, and frozen into a generated literal
 * that a browser imports. A `loader`, a `component`, a `beforeLoad` or a `head`
 * is executable behaviour and belongs in the route *module*, which is fetched
 * as its own chunk; see `./module` for that half of the contract.
 *
 * What earns a place here is a question the runtime has to answer **before** it
 * can fetch that module: which URL is this (`path`), what shape is it in the
 * tree (`kind`, `parentId`), which strings must be in flight alongside its chunk
 * rather than a round trip after it (`namespaces`), and may this visitor be sent
 * here at all (`requires`).
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
  /** Defaults to `"page"`. See {@link PluginRouteKind}. */
  kind?: PluginRouteKind;
  /**
   * The message namespaces this route renders, warmed before it does.
   *
   * Here rather than in the module because of a waterfall that is otherwise
   * unavoidable: a route's messages and a route's code are two network fetches,
   * and if the list of namespaces is *inside* the code they can only happen one
   * after the other. Declared here, the runtime starts both at once.
   *
   * Name what the page renders, not what the plugin has. The root provides
   * `core.global` and nothing else deliberately - the merged message tree holds
   * every plugin's copy, and a page should ship only the branches it uses.
   */
  namespaces?: string[];
  /**
   * The `id` of another route **from the same plugin** that this one renders
   * inside, if any.
   *
   * Plugin-local by construction, which is how cross-plugin parenting is made
   * unrepresentable rather than merely forbidden: there is nowhere in this
   * string to put another plugin's name. A plugin cannot reach into another
   * plugin's frame, and no plugin's route tree depends on which plugins happen
   * to be installed beside it.
   *
   * The parent must be a `layout`, and this route's `path` must be the parent's
   * path or extend it - a child that claimed an unrelated URL would be a
   * manifest that lies about where its pages are. A child whose path is
   * *exactly* the parent's is that layout's index route: `/settings` under the
   * `/settings` layout, which is `page.tsx` beside `layout.tsx`.
   */
  parentId?: string;
  /**
   * Canonical VitNode path: `/blog`, `/blog/:slug`, `/blog/:slug/comments`.
   *
   * Neither Next's `[slug]` nor TanStack's `$slug`. See `./path` for the
   * conversions, and for the shapes this layer rejects rather than guesses at.
   *
   * Always the **full** public path, including a parent layout's segments, even
   * for a nested route. A relative fragment would make a manifest unreadable
   * without walking the graph, and would make a collision impossible to see in
   * a diff.
   */
  path: string;
  /** Who this route is offered to. See {@link PluginRouteRequirement}. */
  requires?: PluginRouteRequirement;
}

/**
 * One route in a built manifest: validated, normalised and parsed.
 *
 * Every optional field of a {@link PluginRouteDefinition} is present here, with
 * its default filled in - so nothing downstream re-implements "and if it is
 * missing, it means". The generated manifest is a literal of exactly this shape,
 * checked with `satisfies`, which is what makes a generator that forgets a field
 * a compile error rather than a route that silently loses its parent.
 */
export interface PluginRoute {
  area: PluginRouteArea;
  entry: string;
  /**
   * Globally unique, `"<pluginId>:<routeId>"` - and the key
   * `framework/plugin-routes` registers the route's module loader under.
   */
  id: string;
  kind: PluginRouteKind;
  /** Declared namespaces, de-duplicated and sorted. Empty if none. */
  namespaces: string[];
  /**
   * The **global** id of this route's parent, or `null`.
   *
   * Namespaced on the way in, so the runtime looks a parent up by the same id
   * everything else addresses a route by, while a plugin still declares only its
   * own local one.
   */
  parentId: null | string;
  /** Canonical path, normalised (no trailing slash). */
  path: string;
  pluginId: string;
  /** As declared. `null` means the route is offered to everybody. */
  requires: null | PluginRouteRequirement;
  /** The plugin-local half of {@link PluginRoute.id}, as declared. */
  routeId: string;
  /** `path`, already parsed - so nothing downstream has to parse it again. */
  segments: PluginRouteSegment[];
}

/**
 * Every plugin route in an application, deterministically ordered.
 *
 * A plain array rather than a wrapper object: it is a list of routes, and the
 * hierarchy it may describe is derived from it by `buildPluginRouteGraph` - by
 * the same function at build time and at runtime, so the two cannot disagree
 * about what the tree is.
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
