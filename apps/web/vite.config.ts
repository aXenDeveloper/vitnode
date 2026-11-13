import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { prerenderRoutes, vitnode } from '@vitnode/core/framework/vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { defineConfig } from 'vite'

import { docsPrerenderPaths } from './src/docs/prerender.ts'
import { PRERENDERED_PATHS } from './src/site/prerender.ts'
import { vitNodeConfig } from './src/vitnode.config.ts'

// `pnpm build:cloudflare` sets this: one Cloudflare Worker serves the site,
// the API and the realtime hub. Every other build, and `vite dev`, is Node.
const CLOUDFLARE = process.env.NITRO_PRESET === 'cloudflare-module'

const config = defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${import.meta.dirname}/src/` }],
    tsconfigPaths: true,
  },
  server: { strictPort: true },
  plugins: [
    vitnode({
      appRoot: import.meta.dirname,
      nitro: {
        ...(CLOUDFLARE ? { preset: 'cloudflare-module' } : {}),
        prerender: {
          routes: prerenderRoutes({
            i18n: vitNodeConfig.i18n,
            paths: [...PRERENDERED_PATHS, ...docsPrerenderPaths()],
          }),
        },
      },
      // On Workers, `/api/ws` is the `VitNodeRealtimeHub` Durable Object.
      webSocket: CLOUDFLARE ? { transport: 'cloudflare' } : true,
    }),
    fumadocsMdx({ index: false }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
