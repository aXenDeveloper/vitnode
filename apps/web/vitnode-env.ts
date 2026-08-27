import type { Plugin } from 'vite'

import { loadEnv } from 'vite'

/**
 * The `NEXT_PUBLIC_*` values a browser bundle needs literally.
 *
 * `@vitnode/core`'s config reads `process.env.NEXT_PUBLIC_API_URL` to build
 * absolute API URLs, and it is the same module on both sides of the render - so
 * the fetcher running in a client component needs that read to resolve to
 * something in a browser, where there is no `process`. Next.js solves this by
 * inlining `NEXT_PUBLIC_*` into the client bundle; this is the same trick, so the
 * variable names stay exactly as they are and no existing install has to rename
 * anything.
 *
 * An explicit list rather than a prefix rule: everything named here is compiled
 * into JavaScript that anyone can read, so it should be a decision, not a
 * consequence of what somebody happened to call a variable. Add a key to publish
 * one more.
 */
const CLIENT_ENV_KEYS = [
  'NEXT_PUBLIC_API_URL',
  // Temporary, for the length of the migration: the origin serving the routes
  // this app does not own yet. `components/migration-link.tsx` reads it in the
  // browser, so it has to be inlined like the others. See `src/lib/legacy-app.ts`.
  'NEXT_PUBLIC_LEGACY_WEB_URL',
  'NEXT_PUBLIC_WEB_URL',
] as const

/**
 * Environment handling for a TanStack Start app that serves a VitNode API.
 *
 * Two halves, deliberately different:
 *
 * - **Server.** `.env` is loaded into `process.env` so anything reading it at
 *   config or request time sees it, whatever import runs first. Nothing is
 *   inlined, so `CONFIG`'s lazy getters keep reading the live environment and a
 *   built server can still be pointed at a different API by its host.
 * - **Client.** Only the keys above, and only as literals in the browser bundle.
 *
 * Secrets - `POSTGRES_URL`, `REDIS_URL`, `CRON_SECRET` - are loaded for the
 * server and never defined for the client, which is the entire reason the two
 * halves are written separately.
 */
export const vitNodeEnv = (): Plugin => ({
  config: (userConfig, { mode }) => {
    // Empty prefix: the whole `.env`, not just the public keys. This is the
    // server's copy, and the API needs the database and Redis URLs from it.
    const env = loadEnv(mode, userConfig.root ?? process.cwd(), '')

    // `??=`, so a real environment variable - Docker, Vercel, CI - always wins
    // over a `.env` file left in the working directory.
    for (const [key, value] of Object.entries(env)) {
      process.env[key] ??= value
    }

    return {
      environments: {
        client: {
          define: Object.fromEntries(
            CLIENT_ENV_KEYS.map((key) => [
              `process.env.${key}`,
              // `undefined` when unset rather than nothing at all: the read has
              // to be replaced either way, or it throws in the browser instead
              // of falling through to the default `CONFIG` already has for it.
              process.env[key] === undefined
                ? 'undefined'
                : JSON.stringify(process.env[key]),
            ]),
          ),
        },
      },
    }
  },
  name: 'vitnode:env',
})
