import {
  definePluginRoutes,
  index,
  layout,
  lazy,
  page,
} from "@vitnode/core/routing";

import { browseSearch } from "./pages/browse-search";

/**
 * The routes this plugin contributes to whatever app installs it.
 *
 * A tree, and browser-safe by construction: a path, the shell it renders in, the
 * message namespaces it needs, and one `lazy(() => import(...))` per page.
 * Nothing here imports a router and nothing here imports a page - the `import()`
 * inside `lazy` is a literal Vite follows at build time and Rollup gives its own
 * chunk, and it does not run until the route is matched or preloaded.
 *
 * That is what lets an app read this list in Node while it builds, with no React
 * in the process, and still end up with one chunk per page: the tree is the
 * declaration, the imports are the code, and the two live in the same file
 * without being loaded at the same time.
 *
 * `config.tsx` hands this same array to `buildPlugin({ routes })`, so a host that
 * registers the plugin through its config declares exactly the same routes as one
 * that reads this module at build time - one list, read by both paths.
 *
 * ## What this file is an example of
 *
 * Two things, deliberately separated, because a plugin only ever needs the first
 * one and every plugin needs to be able to find out what the second costs.
 *
 * `/example` is the **minimum**: a path and a component. Its module is a bare
 * `export default`. A plugin with one public page writes this and stops.
 *
 * `/example/guide` is the rest of the contract, as small as it can be written
 * and still be real: a `layout()` that frames its children, the `index()` page
 * inside it, a dynamic child, the message namespaces those three render, and - in
 * the modules themselves - a loader, page metadata, a breadcrumb and a search
 * contract. One tree rather than four separate examples, because what is worth
 * showing is how they fit together.
 *
 * Note what is *not* here: no locale. `/example` and `/pl/example` are one route,
 * because the host strips the prefix before matching and writes it back into
 * every link it builds. A plugin declares the logical path only.
 */
export const routes = definePluginRoutes([
  page("/example", {
    component: lazy(() => import("./pages/example-page")),
  }),

  /**
   * A page whose query string is validated by the **router**, not by its module.
   *
   * `search` is the one field of a route that is deliberately eager, and the
   * only thing in this file with a cost: it is a function, so it lives in this
   * module rather than in the page's chunk, and everything it imports is in the
   * initial bundle with it. That is the price of being early - a router's
   * `validateSearch` runs while it matches the URL, before any chunk is fetched,
   * so a schema in the lazy page module would arrive long after the answer was
   * needed.
   *
   * Declare it only for a page whose URL *is* its state: a paginated list whose
   * `?page=999` has to be clamped, a filter whose links have to be typed.
   * `/example/guide/:topic` below is the ordinary case - it reads its query
   * string through its own module's lazy `parseSearch`, and adds nothing to the
   * initial bundle.
   */
  page("/example/browse", {
    component: lazy(() => import("./pages/browse-page")),
    messages: ["@vitnode/example.browse"],
    search: browseSearch,
  }),

  /**
   * A frame, and no URL of its own.
   *
   * `layout()` is what makes `/example/guide` two routes rather than one
   * ambiguous one: this renders the heading and the surrounding chrome, and the
   * `index()` inside it renders what goes at that same path - the `layout.tsx`
   * and `page.tsx` pair, said as a tree. A layout may not be a leaf, so removing
   * its children is a build error rather than a route nothing can reach.
   *
   * The messages sit here rather than on each child. They are declared on the
   * route because they have to be known *before* the page's chunk is fetched -
   * the strings and the code are two requests, and a list that lived inside the
   * code could only be read after downloading the page it describes. A child
   * inherits every namespace its ancestors declare, so naming them once on the
   * frame is what stops three routes repeating one list.
   *
   * Every path below is **relative** to this one. The layout's is absolute
   * because it is a top-level route; a child adds what it adds, and VitNode
   * joins the two - so moving this subtree is one edit rather than four.
   */
  layout("/example/guide", {
    component: lazy(() => import("./pages/guide-layout")),
    messages: ["@vitnode/example.guide"],
    children: [
      /** The page at the layout's own URL - `/example/guide`. */
      index({
        component: lazy(() => import("./pages/guide-index-page")),
      }),

      /**
       * A dynamic child: `:topic`, in VitNode's spelling.
       *
       * Neither Next's `[topic]` nor TanStack's `$topic` - the host converts.
       * Relative to the layout, so the full path is `/example/guide/:topic` and
       * nothing here repeats the parent's segments.
       *
       * It declares no messages of its own. The frame above declares the set all
       * three routes render in, and a child inherits every namespace its
       * ancestors declare, so this route ships one line and still has its
       * strings in flight beside its chunk.
       */
      page(":topic", {
        component: lazy(() => import("./pages/guide-topic-page")),
      }),
    ],
  }),

  /**
   * A page in the **AdminCP**, and the whole of what that costs: one field.
   *
   * `area: "admin"` names the shell the page is framed by - the sidebar, the
   * breadcrumb area, the command palette and the admin session guard - and the
   * host mounts it under whichever route renders that shell. It does *not* put
   * `/admin` in front of the path: both shells are pathless, so an area frames a
   * page rather than moving it, and the URL below is written out in full. That
   * is also why a `main` route at `/admin/example` would be a collision with
   * this rather than a second page - one URL is one URL whichever frame draws
   * it.
   *
   * `requires` is absent and may not be present: it is about the *public*
   * session, and this page is already behind the AdminCP's own, under its own
   * cookie. A staff permission gates the page's content, inside the module.
   */
  page("/admin/example", {
    area: "admin",
    component: lazy(() => import("./pages/admin-example-page")),
    messages: ["@vitnode/example.admin.overview"],
  }),
]);
