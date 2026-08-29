/**
 * The pathless route every plugin page is mounted under.
 *
 * Pathless, so it contributes no URL segment: a plugin route at `/example` is
 * served at `/example`, not at `/_plugins/example`. It earns its place by making
 * the composition **idempotent** - the plugin subtree is one child of its mount
 * point, identifiable by this id, so re-running the composition replaces it
 * instead of appending a second copy of every route. That is not a theoretical
 * concern: in dev, Vite re-evaluates the module that composes the tree without
 * re-evaluating `routeTree.gen.ts`, and the route it mutates is the same object.
 *
 * It also gives the whole plugin subtree one name in the router devtools, and
 * one place for a future stage to hang something every plugin page needs.
 *
 * Its own module so that `./collision` - which has to skip the subtree while
 * asking the application what it owns - and `./mount`, which creates it, can
 * both name it without importing each other.
 */
export const PLUGIN_ROUTES_ROUTE_ID = "_plugins";
