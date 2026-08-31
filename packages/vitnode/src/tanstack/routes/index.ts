/**
 * `@vitnode/core/tanstack/routes` - every route VitNode itself owns.
 *
 * ## What is here, and what is not
 *
 * **Routes only.** A file in this tree declares a URL, a loader, a guard, a
 * `head` and a breadcrumb - and imports the screen it renders from the namespace
 * that owns it. Nothing here is a component: the sign-in card lives in
 * `tanstack/auth`, the settings frame in `tanstack/settings`, the AdminCP's
 * staff list in `tanstack/admin/staff`. This tree is the *routing* over them,
 * and the split is what lets a Next.js host use the screens without any of it.
 *
 * ## Three folders, one per mount point
 *
 *     main/    under the application's main shell   /discover, /search, /files, /settings
 *     admin/   under the AdminCP shell              /admin/core/…, /admin/content/*
 *     root/    under no shell at all                /login, /register, /admin
 *
 * `main` and `admin` are named after the shell they hang from, so `root` is
 * named after its mount point too: these screens are children of the root route,
 * with nothing between. An auth card is the whole page, and the AdminCP's own
 * sign-in has to sit *outside* the AdminCP shell or its guard would loop.
 *
 * ## What replaced what
 *
 * Twenty-nine route files in every application, and a copy of all of them in the
 * scaffold. `apps/web/src/routes/` held one `createFileRoute` per screen and not
 * one of them was the application's: the loader, the component, the search
 * normaliser and the breadcrumb all came from this package, and the file existed
 * only so a file-based router would see a path. So an app that installed VitNode
 * carried a copy of VitNode's own routing table, and core adding a screen was an
 * edit in every application that had one - the same duplication a copied plugin
 * page is, one package up.
 *
 * ## What an application still owns
 *
 * Its shells (`__root`, `_main`, `_admin`), its front page, and anything it
 * wrote itself. Each shell also keeps exactly one file-based child, because a
 * pathless layout with no file children is dropped from the generated route tree
 * and collapses to `/`.
 *
 * ## Why these are code-based routes and not plugin manifest entries
 *
 * They need options a lazily-imported module cannot provide. `validateSearch`
 * runs during path matching, before any chunk is fetched, and these screens keep
 * their state in the query string; a `beforeLoad` guard has the same problem one
 * level up, since a requirement in a lazy module could only be read by
 * downloading the page it was meant to withhold; and a splat
 * (`/admin/content/$`) is not representable in the manifest's path grammar at
 * all. Core is not a third-party package and does not need that layer's
 * guarantees about untrusted plugins - what it needs is the router's own option
 * set, which is what a code-based route is.
 */

export { CORE_ADMIN_ROUTES_ROUTE_ID, withCoreAdminRoutes } from "./admin";
export {
  CORE_AUTHENTICATED_ROUTES_ROUTE_ID,
  CORE_MAIN_ROUTES_ROUTE_ID,
  withCoreMainRoutes,
} from "./main";

export { CORE_ROOT_ROUTES_ROUTE_ID, withCoreRootRoutes } from "./root";
export type { CoreRootRouteContext, CoreRootRouteFactory } from "./root/types";
export type {
  CoreAdminRouteContext,
  CorePageHead,
  CoreRouteContext,
  CoreRouteFactory,
} from "./types";
