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
      /**
       * Fumadocs MDX's generated collections, stubbed.
       *
       * `.source/*` is written by `fumadocs-mdx/vite`, which is not in this
       * config - these are server-side tests over `Request`/`Response` and a
       * `renderToString`, and compiling 120 MDX documents to run them would be
       * absurd. Several tests build the real router, which imports every route
       * file including the documentation's, so the alias is what stops that
       * reaching the content. See `src/tests/docs-runtime/collections-server.ts`.
       */
      'collections/browser': resolve(
        import.meta.dirname,
        './src/tests/docs-runtime/collections-browser.ts',
      ),
      'collections/server': resolve(
        import.meta.dirname,
        './src/tests/docs-runtime/collections-server.ts',
      ),
      '#': resolve(import.meta.dirname, './src'),
      '@': resolve(import.meta.dirname, './src'),
    },
  },
})
