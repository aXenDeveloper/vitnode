import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Deliberately free of the app's Vite plugins (`tanstackStart`, `nitro`,
// `viteReact`): these are server-side integration tests over plain
// `Request`/`Response`, and loading the Start plugin here would pull the whole
// router build pipeline into the test run for no assertion it makes.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.output/**',
      '**/.nitro/**',
      '**/.tanstack/**',
    ],
  },
  resolve: {
    alias: {
      '#': resolve(import.meta.dirname, './src'),
      '@': resolve(import.meta.dirname, './src'),
    },
  },
})
