import type { PluginRouteDefinition } from "@vitnode/core/routing";

/**
 * The routes this plugin contributes to whatever app installs it.
 *
 * Plain data, and framework-neutral by construction: an `entry` is a *package
 * export subpath*, so `"routes/example-page"` is imported as
 * `"@vitnode/example/routes/example-page"` and resolves through this package's
 * export map to its build output. Nothing here imports a router, and nothing
 * here imports a page - so an app can read this list at build time, in Node,
 * without pulling a single React component into the process.
 *
 * That is what lets the app generate literal `import()` calls for these modules
 * instead of building specifiers at runtime: the ids and entries are known
 * before the bundler runs, so Rollup gives each page its own lazily fetched
 * chunk and the browser never has to ask which plugins are installed.
 *
 * `config.tsx` hands this same array to `buildPlugin({ routes })`, so a host that
 * registers the plugin through its config declares exactly the same routes as one
 * that reads the manifest at build time - one list, read by both paths.
 *
 * ## What this file is an example of
 *
 * Two things, deliberately separated, because a plugin only ever needs the first
 * one and every plugin needs to be able to find out what the second costs.
 *
 * `/example` is the **minimum**: an id, a path and an entry. Everything else on
 * `PluginRouteDefinition` has a default, and its module is a bare
 * `export default`. A plugin with one public page writes this and stops.
 *
 * `/example/guide` is the rest of the contract, as small as it can be written
 * and still be real: a `layout` that frames its children, the index page inside
 * it, a dynamic child, the message namespaces those three render, and - in the
 * modules themselves - a loader, page metadata, a breadcrumb and a search
 * contract. Four routes rather than four separate examples, because what is
 * worth showing is how they fit together.
 *
 * Note what is *not* here: no locale. `/example` and `/pl/example` are one route,
 * because the host strips the prefix before matching and writes it back into
 * every link it builds. A plugin declares the logical path only.
 */
export const routes: PluginRouteDefinition[] = [
  {
    entry: "routes/example-page",
    id: "example-page",
    path: "/example",
  },

  /**
   * A frame, and no URL of its own.
   *
   * `kind: "layout"` is what makes `/example/guide` two routes rather than one
   * ambiguous one: this renders the heading and the surrounding chrome, and the
   * `guide-index` below renders what goes inside it at that same path - the
   * `layout.tsx` and `page.tsx` pair, said as data. A layout may not be a leaf,
   * so removing either of its children below is a build error rather than a
   * route nothing can reach.
   *
   * The namespaces sit here rather than on each child. They are declared on the
   * route because they have to be known *before* the module's chunk is fetched -
   * the strings and the code are two requests, and a list that lived inside the
   * code could only be read after downloading the page it describes. A child
   * inherits every namespace its ancestors declare, so naming them once on the
   * frame is what stops three routes repeating one list.
   */
  {
    entry: "routes/guide-layout",
    id: "guide",
    kind: "layout",
    namespaces: ["@vitnode/example.guide"],
    path: "/example/guide",
  },

  /**
   * The index page of the layout above: the same path, parented to it.
   *
   * `parentId` is this plugin's *own* route id, never `"@vitnode/example:guide"`
   * and never another plugin's - there is nowhere in this string to put another
   * plugin's name, which is how cross-plugin nesting is made unrepresentable
   * rather than merely discouraged.
   *
   * `path` is the **full** public path even though this route is nested. A
   * relative fragment would make the manifest unreadable without walking the
   * graph, and would make a URL collision impossible to see in a diff.
   */
  {
    entry: "routes/guide-index-page",
    id: "guide-index",
    parentId: "guide",
    path: "/example/guide",
  },

  /**
   * A dynamic child: `:topic`, in VitNode's spelling.
   *
   * Neither Next's `[topic]` nor TanStack's `$topic` - the host converts. Its
   * path extends the parent's, which is checked: a child claiming an unrelated
   * URL would be a manifest that lies about where its pages are.
   *
   * It declares no namespaces of its own. The frame above declares the set all
   * three routes render in, and a child inherits every namespace its ancestors
   * declare, so this route ships one line and still has its strings in flight
   * beside its chunk.
   */
  {
    entry: "routes/guide-topic-page",
    id: "guide-topic",
    parentId: "guide",
    path: "/example/guide/:topic",
  },

  /**
   * A page in the **AdminCP**, and the whole of what that costs: one field.
   *
   * `area: "admin"` names the shell the page is framed by - the sidebar, the
   * breadcrumb area, the command palette and the admin session guard - and the
   * host mounts it under whichever route renders that shell. It does *not* put
   * `/admin` in front of the path: both shells are pathless, so an area frames a
   * page rather than moving it, and the URL below is written out in full. That
   * is also why `main /admin/example` would be a collision with this rather than
   * a second page - one URL is one URL whichever frame draws it.
   *
   * `requires` is absent and may not be present: it is about the *public*
   * session, and this page is already behind the AdminCP's own, under its own
   * cookie. A staff permission gates the page's content, inside the module.
   *
   * The entry is a normal package export subpath like every other one here.
   * There was briefly a second convention - `routes/admin/`, a directory of
   * framework route files copied wholesale into a host's own app directory - and
   * a module in both places was copied *and* bundled. Manifest entries are now
   * the only way a plugin contributes a page.
   */
  /**
   * A page whose query string is validated by the **router**, not by its module.
   *
   * The one field here that costs something, and the only one that does:
   * `searchEntry` names a second module, and the app's build imports it
   * *statically*. That is the price of being early - a router's
   * `validateSearch` runs during path matching, before any chunk is fetched, so
   * a schema in the lazy page module would arrive too late to shape anything.
   *
   * Declare it only for a page whose URL *is* its state - a paginated list whose
   * `?page=999` has to be clamped, a filter whose links have to be typed and
   * checked. `/example/guide/:topic` above is the ordinary case: it reads its
   * query string through its own module's `parseSearch`, lazily, and nothing is
   * added to the initial bundle.
   */
  {
    entry: "routes/browse-page",
    id: "browse",
    namespaces: ["@vitnode/example.browse"],
    path: "/example/browse",
    searchEntry: "routes/browse-page.search",
  },
  {
    area: "admin",
    entry: "routes/admin-example-page",
    id: "admin-overview",
    namespaces: ["@vitnode/example.admin.overview"],
    path: "/admin/example",
  },
];
