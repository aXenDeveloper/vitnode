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
 * instead of building specifiers at runtime: the ids and entries are known before
 * the bundler runs, so Rollup gives each page its own lazily fetched chunk and
 * the browser never has to ask which plugins are installed.
 *
 * Route *semantics* - the URL a route is served at, its area, its loader, its
 * metadata, its permissions - belong on these records too, and are owned by the
 * plugin route manifest contract (`@vitnode/core/routing`) rather than by the
 * two fields the build reads. `path` is the first of them: `/example` in the
 * canonical VitNode spelling, which is neither Next's `[id]` nor TanStack's
 * `$id`, and `area` defaults to `"main"`. The registry generator reads `id` and
 * `entry` and ignores the rest, so this list can keep growing without the build
 * changing.
 *
 * `config.tsx` hands this same array to `buildPlugin({ routes })`, so a Next.js
 * app that registers the plugin the usual way declares exactly the same routes -
 * one list, read by both paths.
 */
export const routes: PluginRouteDefinition[] = [
  {
    entry: "routes/example-page",
    id: "example-page",
    path: "/example",
  },
];
