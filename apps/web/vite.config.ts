import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { vitNodeEnv, vitNodePluginRoutes } from '@vitnode/core/framework/vite'
import fumadocsMdx from 'fumadocs-mdx/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: {
    /**
     * `@/…` for files `tsconfig.json` does not cover.
     *
     * `tsconfigPaths` resolves the alias for everything under `src`, and seven
     * documents under `content/docs` import `@/components/fumadocs/img` - the
     * framed, zoomable screenshot wrapper. `content` is outside the tsconfig's
     * `include`, so no tsconfig applies to an MDX file and the path mapping is
     * never consulted; the build fails to resolve the import outright.
     *
     * The alias restates the mapping the tsconfig already declares, for the one
     * kind of file that cannot inherit it. The `@/` in the pattern is
     * load-bearing: a bare `@` would prefix-match `@vitnode/core` and
     * `@tanstack/react-router` and rewrite both into this app's `src`.
     */
    alias: [{ find: /^@\//, replacement: `${import.meta.dirname}/src/` }],
    tsconfigPaths: true,
  },
  /**
   * A second dev server has to fail rather than quietly move.
   *
   * `tanstackStart()` runs the route generator and *writes*
   * `src/routeTree.gen.ts`. Two servers means two generators owning one file: if
   * their route lists ever differ - which is precisely what happens when one was
   * started before a route file existed - they overwrite each other forever, and
   * every write is a full page reload. Without `strictPort` the second `pnpm dev`
   * says "Port 3001 is in use, trying another one" and succeeds, so the fight
   * starts silently and looks like an inexplicable refresh loop on the first
   * server.
   */
  server: { strictPort: true },
  ssr: {
    /**
     * The VitNode API packages mounted at `/api/*`, kept out of the SSR pass.
     *
     * They are Node libraries rather than app source: `@vitnode/core` loads its
     * locale files with a runtime `import("./en.json", { with: { type: "json" } })`
     * relative to its own `dist`. Bundling them in this pass moves that chunk
     * and the JSON stops resolving, which fails the build outright. Left
     * external here, Nitro resolves them from the package itself.
     *
     * Vite treats workspace-linked packages as `noExternal` by default, which is
     * why they have to be named.
     *
     * This is also what decides the shape of `@vitnode/core/tanstack/*`, so it is
     * worth naming the consequence rather than leaving it to be rediscovered.
     * Externalised here, the package skips this pass entirely and Nitro's own
     * Rollup run inlines its `dist` afterwards - and nothing in that path runs
     * the TanStack Start compiler. The *client* build has no such gap: it inlines
     * the package, so the compiler transforms it there. So package code reaches
     * the browser compiled and the server un-compiled, which is exactly why the
     * package may declare `createIsomorphicFn` (its stub falls back to the
     * `.server()` branch, which is what a server wants) and may never declare
     * `createServerFn` (un-compiled, its handler resolves to `undefined` with no
     * error at all). `packages/vitnode/src/tanstack/boundary.test.ts` holds the
     * package to that.
     *
     * Removing `@vitnode/core` from this list to close the gap was measured and
     * does not work: the SSR pass then reaches the locale barrel above and the
     * build fails on `Could not resolve './en.json'`.
     *
     * ## `tslib` is here for an entirely different reason
     *
     * It is not a VitNode package and it is not a Node library. It is here
     * because bundling it is broken, in a way that only appears in a production
     * build and only once a page renders.
     *
     * Fumadocs' dialogs bring in the Radix scroll-lock stack -
     * `react-remove-scroll`, `use-sidecar`, `aria-hidden` - and every one of them
     * does `import { __extends } from "tslib"`. Under the `node` condition that
     * resolves to `tslib/modules/index.js`, a two-line ESM shim around the
     * **CommonJS** `tslib.js`:
     *
     *     import tslib from "../tslib.js";
     *     const { __extends, … } = tslib;
     *
     * `tslib.js` defines `__esModule` on its exports, so Rolldown's CJS interop
     * helper does not synthesise a `default` - while the call site it generated
     * still reads `.default`. Every documentation page that renders a dialog
     * then throws `Cannot destructure property '__extends' of undefined`.
     *
     * Externalised, the file is never bundled: Nitro traces the package into the
     * output and Node loads it with Node's own interop, which is correct. An
     * alias to `tslib/tslib.es6.mjs` was tried first and is worse - it fixes
     * Vite's copy and not Nitro's, because Nitro re-resolves externals itself,
     * and the tracer then copies only the file the alias named.
     */
    external: ['@vitnode/core', '@vitnode/blog', '@vitnode/example', 'tslib'],
  },
  plugins: [
    /**
     * Both from `@vitnode/core/framework/vite`, and what they take is the whole
     * of what is this application's rather than VitNode's.
     *
     * `NEXT_PUBLIC_LEGACY_WEB_URL` is the origin still serving the routes this
     * app has not taken over. It is inlined into the browser bundle because
     * `src/migration/legacy-app.ts` reads it there - and it is passed in rather
     * than living on the package's own list because "there is a second, older
     * application" is true for the length of this migration and false before and
     * after it.
     *
     * `appRoot` is `import.meta.dirname` because a Vite config is loaded with the
     * working directory set to wherever the command ran, which in this monorepo
     * is regularly the repository root.
     */
    vitNodeEnv({ clientEnv: ['NEXT_PUBLIC_LEGACY_WEB_URL'] }),
    vitNodePluginRoutes({ appRoot: import.meta.dirname }),
    /**
     * The documentation collection, compiled by Vite rather than by a Next.js
     * webpack loader.
     *
     * Fumadocs MDX's own Vite integration - `fumadocs-mdx/vite` - and not a
     * hand-rolled MDX pipeline. It does three things this app depends on: it
     * transforms `content/docs/**` on demand, it writes `.source/{server,browser}.ts`
     * (the `collections/*` alias in `tsconfig.json`), and it contributes the
     * `optimizeDeps` entries the MDX runtime needs under `vite dev`.
     *
     * **Before `tanstackStart()`**, because that plugin's route generator and
     * the Start compiler both run over a graph that now contains generated
     * modules: `.source/browser.ts` is a file this plugin writes, and it has to
     * exist before anything walks it. The MDX transform is declared `order:
     * "pre"` on its own hooks, so this is about the config and emit phases
     * rather than about transform precedence.
     *
     * There is deliberately no `dir`, `outDir` or `configPath` here: the plugin
     * reads `source.config.ts` from the app root, which is where it is.
     */
    fumadocsMdx(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
