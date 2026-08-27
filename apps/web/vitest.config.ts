import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * `tanstackStart()` and nothing else.
 *
 * The Start plugin is what compiles `createServerFn` and `createIsomorphicFn`:
 * un-compiled, a server function called from a loader resolves to `undefined`
 * and an isomorphic function silently keeps its server branch. Both are load
 * bearing here - the SSR tests render the real app, whose root loader fetches
 * its messages through a server function - so the tests run through the same
 * transform the build does.
 *
 * `nitro` and `viteReact` stay out: these are server-side tests over plain
 * `Request`/`Response` and a `renderToString`, and neither plugin has anything
 * to contribute to that.
 */
export default defineConfig({
  plugins: [tanstackStart()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        inline: [/@tanstack\/react-start/, /@tanstack\/start-server-core/],
      },
    },
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
      'tanstack-start-manifest:v': resolve(
        import.meta.dirname,
        './src/tests/start-runtime/manifest.ts',
      ),
      '#tanstack-router-entry': resolve(
        import.meta.dirname,
        './src/tests/start-runtime/router-entry.ts',
      ),
      '#tanstack-start-entry': resolve(
        import.meta.dirname,
        './src/tests/start-runtime/start-entry.ts',
      ),
      '#tanstack-start-plugin-adapters': resolve(
        import.meta.dirname,
        './src/tests/start-runtime/plugin-adapters.ts',
      ),
      '#': resolve(import.meta.dirname, './src'),
      '@': resolve(import.meta.dirname, './src'),
    },
  },
})
