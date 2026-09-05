import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { vitnode } from '@vitnode/core/framework/vite'
import fumadocsMdx from 'fumadocs-mdx/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: `${import.meta.dirname}/src/` }],
    tsconfigPaths: true,
  },
  server: { strictPort: true },
  plugins: [
    vitnode({ appRoot: import.meta.dirname }),
    fumadocsMdx(),
    devtools(),
    nitro(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
