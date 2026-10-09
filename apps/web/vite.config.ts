import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { prerenderRoutes, vitnode } from '@vitnode/core/framework/vite'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

import { PRERENDERED_PATHS } from './src/site/prerender.ts'
import { vitNodeConfig } from './src/vitnode.config.ts'

const config = defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${import.meta.dirname}/src/` }],
    tsconfigPaths: true,
  },
  server: { strictPort: true },
  plugins: [
    vitnode({ appRoot: import.meta.dirname }),
    fumadocsMdx({ index: false }),
    devtools(),
    nitro({
      prerender: {
        routes: prerenderRoutes({
          i18n: vitNodeConfig.i18n,
          paths: PRERENDERED_PATHS,
        }),
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
