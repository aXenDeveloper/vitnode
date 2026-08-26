import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

import { vitNodeEnv } from './vitnode-env'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
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
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
