import type { Plugin } from "vite";

import { loadEnv } from "vite";

/**
 * The `NEXT_PUBLIC_*` values every VitNode app's browser bundle needs literally.
 *
 * `@vitnode/core`'s config reads `process.env.NEXT_PUBLIC_API_URL` to build
 * absolute API URLs, and it is the same module on both sides of the render - so
 * the fetcher running in a client component needs that read to resolve to
 * something in a browser, where there is no `process`. Next.js solves this by
 * inlining `NEXT_PUBLIC_*` into the client bundle; this is the same trick, so
 * the variable names stay exactly as they are and no existing install has to
 * rename anything.
 *
 * An explicit list rather than a prefix rule: everything here is compiled into
 * JavaScript that anyone can read, so it should be a decision, not a consequence
 * of what somebody happened to call a variable. These two are the ones *this
 * package* reads. An application publishes one more through `clientEnv` rather
 * than by editing this list - see {@link VitNodeEnvOptions.clientEnv}.
 */
const CLIENT_ENV_KEYS = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WEB_URL"] as const;

export interface VitNodeEnvOptions {
  /**
   * Extra keys to inline into the client bundle, on top of the two above.
   *
   * For values the *application* reads in the browser, which the package cannot
   * know about. Anything named here is public by construction, so the list is
   * the place a reviewer looks to see what an app publishes.
   *
   * VitNode's own TanStack migration is the worked example: `apps/web` adds
   * `NEXT_PUBLIC_LEGACY_WEB_URL`, the origin still serving the routes it has not
   * taken over. That is true for the length of a migration and false before and
   * after it, which is exactly the kind of key that belongs to an app and not to
   * this list.
   */
  clientEnv?: readonly string[];
}

/**
 * Environment handling for a VitNode app on Vite - `@vitnode/core/framework/vite`.
 *
 * Two halves, deliberately different:
 *
 * - **Server.** `.env` is loaded into `process.env` so anything reading it at
 *   config or request time sees it, whatever import runs first. Nothing is
 *   inlined, so `CONFIG`'s lazy getters keep reading the live environment and a
 *   built server can still be pointed at a different API by its host.
 * - **Client.** Only the keys above plus `clientEnv`, and only as literals in
 *   the browser bundle.
 *
 * Secrets - `POSTGRES_URL`, `REDIS_URL`, `CRON_SECRET` - are loaded for the
 * server and never defined for the client, which is the entire reason the two
 * halves are written separately.
 */
export const vitNodeEnv = ({
  clientEnv = [],
}: VitNodeEnvOptions = {}): Plugin => {
  // De-duplicated, so an app that names one of the package's own keys gets one
  // `define` entry rather than a silently repeated one.
  const keys = [...new Set([...CLIENT_ENV_KEYS, ...clientEnv])];

  return {
    config: (userConfig, { mode }) => {
      // Empty prefix: the whole `.env`, not just the public keys. This is the
      // server's copy, and a mounted VitNode API needs the database and Redis
      // URLs from it.
      const env = loadEnv(mode, userConfig.root ?? process.cwd(), "");

      // `??=`, so a real environment variable - Docker, Vercel, CI - always wins
      // over a `.env` file left in the working directory.
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }

      return {
        environments: {
          client: {
            define: Object.fromEntries(
              keys.map(key => [
                `process.env.${key}`,
                // `undefined` when unset rather than nothing at all: the read
                // has to be replaced either way, or it throws in the browser
                // instead of falling through to the default `CONFIG` already has
                // for it.
                process.env[key] === undefined
                  ? "undefined"
                  : JSON.stringify(process.env[key]),
              ]),
            ),
          },
        },
      };
    },
    name: "vitnode:env",
  };
};
