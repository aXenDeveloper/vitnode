/**
 * The Vite plugins every VitNode app on Vite needs - `@vitnode/core/framework/vite`.
 *
 * A `vite.config.ts` is the one file a framework cannot write for an
 * application: it names the app's own port, its Nitro options, its Tailwind
 * entry. But almost nothing in *these four* is the app's. They read the
 * environment the way VitNode's config expects it to be read, they discover
 * the routes VitNode's plugins declare, and they name this package's own
 * browser dependencies for the dev server's pre-bundler - the same work, in the
 * same order, in every install. Kept as files in each app they were 397 lines to
 * copy and then to keep in step; here they are one call:
 *
 *     import { vitnode } from '@vitnode/core/framework/vite'
 *
 *     plugins: [
 *       vitnode({ appRoot: import.meta.dirname }),
 *       ...
 *     ]
 *
 * The four are still exported individually, for an app that wants to drop or
 * reorder one - {@link vitnode} is their composition, not a wrapper around them.
 *
 * ## Why this is `framework/` and not `tanstack/`
 *
 * Nothing here is TanStack. `vitNodePluginRoutes` writes framework-neutral data
 * and one `import()` per route; which router mounts them is the host's business
 * and `@vitnode/core/tanstack/plugin-routes`'. A VitNode app on Vite without
 * TanStack Start would use both of these unchanged, and `boundary.test.ts`
 * forbids this tree from importing TanStack at all.
 *
 * These run in Node during Vite's config load, never in a bundle. `vite` is an
 * optional peer dependency for exactly that reason: importing this subpath is
 * what makes it required, and a Next.js install never does.
 */

export type { VitNodeEnvOptions } from "./env";
export { vitNodeEnv } from "./env";
export { vitNodeOptimizeDeps } from "./optimize-deps";
export type { VitNodePluginRoutesOptions } from "./plugin-routes";
export { vitNodePluginRoutes } from "./plugin-routes";
export type { VitNodeSsrExternalsOptions } from "./ssr-externals";
export { vitNodeSsrExternals } from "./ssr-externals";
export type { VitNodeViteOptions } from "./vitnode";
export { vitnode } from "./vitnode";
