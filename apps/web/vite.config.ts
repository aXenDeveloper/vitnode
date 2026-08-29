import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { vitNodeEnv, vitNodePluginRoutes } from '@vitnode/core/framework/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
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
     */
    external: ['@vitnode/core', '@vitnode/blog', '@vitnode/example'],
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
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
