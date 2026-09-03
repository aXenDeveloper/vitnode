/**
 * Which of an application's shells a plugin route renders inside.
 *
 * Two members, and each was earned by a stage rather than inherited from the
 * legacy route-copying pipeline, which knew three destinations and wrote a
 * plugin's pages into a Next.js app's `src/app/` by directory name. `main` is
 * the public site. `admin` is the AdminCP: it has its own layout, its own second
 * session under its own cookie, and its own staff permissions. `blank` - a page
 * rendered without the site chrome - is deliberately absent, because it was used
 * once by a core test page and by no plugin, and a member here has to be a shell
 * some route actually renders in.
 *
 * ## An area chooses a parent. It never rewrites a path
 *
 * This is the invariant the whole layer rests on, and adding a second member is
 * what makes it worth stating: a route in the `admin` area declares
 * `path: "/admin/reports"` **in full**. Nothing prefixes it, and nothing infers
 * `/admin` from the area. The area says which shell the page is framed by - and
 * in a router a shell is a parent route, so honouring it means choosing a parent
 * (`@vitnode/core/tanstack/plugin-routes`'s `mountUnder`) and nothing else.
 *
 * A hidden prefix would buy one saved word per declaration and cost the property
 * that makes this manifest reviewable: that the URL a plugin claims is legible
 * in the diff that claims it, and that two routes colliding look like it.
 *
 * ## An area is not part of a URL, so it is not part of a collision either
 *
 * `main /foo` and `admin /foo` are **one URL claimed twice**, and the manifest
 * refuses them. The shells are pathless routes - `_main` and `_admin` contribute
 * no segment - so mounting two routes under different frames does not put them
 * in different pathname spaces: a browser asking for `/foo` would reach whichever
 * one the router happened to rank first. Every collision check in this layer
 * therefore keys on the match key alone, and an admin route's `/admin` comes
 * from its own `path`.
 *
 * Keeping the list *here* rather than letting every route invent its own string
 * is the point: an area is a statement about layout, and a layout is a parent.
 *
 * Declared by a **top-level** route only. Every route inside a layout renders in
 * the shell its layout renders in, so a nested route that declared one would be
 * describing something it cannot change.
 */
export type PluginRouteArea = "admin" | "main";

/**
 * Every area a route may declare, in a fixed order.
 *
 * Sorted, and depended upon: it is what a diagnostic lists when a route names an
 * area that does not exist, and what the TanStack runtime iterates when it hangs
 * one subtree per area off the tree. An order that came out of declaration
 * sequence would make a build's output depend on how this file was edited.
 */
export const PLUGIN_ROUTE_AREAS: PluginRouteArea[] = ["admin", "main"];

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
 * - `page` claims a URL and renders it - `page()` and `index()`, which is that
 *   layout's page at its own URL.
 * - `layout` claims **no URL of its own** - `layout()`. It renders a frame
 *   around its `children` and is only ever reached through one of them, which is
 *   why two layouts may not sit at the same path and why a layout with no
 *   children is rejected: it would be a route nothing can ever match.
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
 * Permissions are deliberately absent, and stayed absent when Stage 12 brought
 * the AdminCP in. This field is about the **public** session - the cookie
 * `/login` sets - and the AdminCP runs on a second session under a second
 * cookie, so the two are not the same question asked at different volumes. An
 * `admin` route inherits its requirement from the shell it mounts under, whose
 * guard reads that other session; declaring one here as well is refused rather
 * than ignored, because a field that reads as enforcement and enforces nothing
 * is worse than no field. Staff permissions gate a page's *content*, through the
 * same components the AdminCP's own screens use.
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
 * A route's `id` is the key its component loader and its search schema are
 * registered under, so one identifier addresses a route everywhere and nothing
 * has to translate between layers.
 */
export const PLUGIN_ROUTE_ID_SEPARATOR = ":";

/** One parsed segment of a canonical VitNode route path. */
export type PluginRouteSegment =
  { kind: "param"; name: string } | { kind: "static"; value: string };

/**
 * One route's `validateSearch`, as the router will call it.
 *
 * Total by contract. TanStack calls this during path matching, on whatever was
 * in the query string, and a throw there is a router error screen rather than a
 * page - so a validator normalises and clamps, it does not reject.
 */
export type PluginRouteSearchValidator = (
  input: Record<string, unknown>,
) => unknown;

/**
 * One route in a built manifest: validated, normalised and parsed.
 *
 * Every optional field of a declaration is present here with its default filled
 * in, so nothing downstream re-implements "and if it is missing, it means", and
 * every path is the full canonical one even for a route whose author wrote it
 * relative to its parent.
 */
export interface PluginRoute {
  area: PluginRouteArea;
  /** Globally unique, `"<pluginId>:<routeId>"`. */
  id: string;
  kind: PluginRouteKind;
  /** Declared message namespaces, de-duplicated and sorted. Empty if none. */
  messages: string[];
  /**
   * The **global** id of the layout this route is nested inside, or `null`.
   *
   * Namespaced by plugin, exactly like {@link PluginRoute.id}, so a parent is
   * looked up by the id everything else addresses a route by - and so there is
   * no spelling of it that reaches another plugin's layout.
   */
  parentId: null | string;
  /** Canonical path, normalised (no trailing slash). */
  path: string;
  pluginId: string;
  /** As declared. `null` means the route is offered to everybody. */
  requires: null | PluginRouteRequirement;
  /**
   * The plugin-local half of {@link PluginRoute.id}, derived by VitNode from the
   * route's kind and its full path while the tree was flattened.
   */
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
 * One plugin, and the route tree it declares.
 *
 * `routes` is `unknown` rather than `PluginRoutes` because a plugin is compiled
 * JavaScript by the time a host reads it: the tree is validated from `unknown`
 * by `flattenPluginRoutes`, which is what turns a plugin built against an older
 * VitNode into a diagnostic rather than a crash.
 */
export interface PluginRouteSource {
  pluginId: string;
  routes?: unknown;
}
