import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

import { vitNodeEnv } from './vitnode-env'
import { vitNodePluginRoutes } from './vitnode-plugin-routes'

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
     */
    external: ['@vitnode/core', '@vitnode/blog', '@vitnode/example'],
  },
  plugins: [
    vitNodeEnv(),
    vitNodePluginRoutes(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
