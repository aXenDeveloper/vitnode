/**
 * The Vite plugins every VitNode app on Vite needs - `@vitnode/core/framework/vite`.
 *
 * A `vite.config.ts` is the one file a framework cannot write for an
 * application: it names the app's own port, its Nitro options, its Tailwind
 * entry. But almost nothing in *these two* is the app's. They read the
 * environment the way VitNode's config expects it to be read, and they discover
 * the routes VitNode's plugins declare - the same work, in the same order, in
 * every install. Kept as files in each app they were 397 lines to copy and then
 * to keep in step; here they are two calls:
 *
 *     import { vitNodeEnv, vitNodePluginRoutes } from '@vitnode/core/framework/vite'
 *
 *     plugins: [
 *       vitNodeEnv(),
 *       vitNodePluginRoutes({ appRoot: import.meta.dirname }),
 *       ...
 *     ]
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
 *
 * ## Generating, and writing, are two exports
 *
 * `vitNodePluginRoutes` is the only thing that *writes* an application's four
 * generated registries, and the plugin is the only entry point that calls it -
 * there is no `vitnode generate`, no `postinstall` and no prebuild step. What
 * the pass decides is `./registries.ts`, exported here as
 * `vitNodeGeneratedRegistries`: the same function, asked for the bytes instead
 * of asked to write them.
 *
 * That second export exists so an installation can hold its generators to
 * account without running a build - generate twice and diff, generate once and
 * compare to what is committed. A test that reimplemented the pass instead would
 * only ever prove the two implementations agree.
 */

export type { VitNodeEnvOptions } from "./env";
export { vitNodeEnv } from "./env";
export type { VitNodePluginRoutesOptions } from "./plugin-routes";
export { vitNodePluginRoutes } from "./plugin-routes";
export type { GeneratedRegistryFile, VitNodeRegistryName } from "./registries";
export {
  vitNodeConfigPath,
  vitNodeGeneratedRegistries,
  vitNodeGeneratedRegistryPaths,
  vitNodeHostRoutesDir,
} from "./registries";
