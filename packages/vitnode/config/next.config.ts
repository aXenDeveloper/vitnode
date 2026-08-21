import type { NextConfig } from "next";

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/vitnode.config.ts");

/**
 * Absolute path to one of the built cache handlers.
 *
 * Next takes a cache handler as a **path** and imports it itself, so this has to
 * point at the compiled file rather than the source. Resolved from this module's
 * own URL rather than through the package name: the config is loaded from inside
 * the package, and locating a sibling file needs no export map, no resolution
 * conditions and no self-reference support.
 */
const handlerPath = (name: string): null | string => {
  const path = fileURLToPath(
    new URL(`../dist/src/lib/cache/${name}.js`, import.meta.url),
  );

  return existsSync(path) ? path : null;
};

/**
 * Redis-backed cache handlers, when `REDIS_URL` is set.
 *
 * `REDIS_URL` is the switch because a cache handler is a module path - there is
 * no way to hand it a config object from here - so the environment is the only
 * channel it has. That also keeps it consistent with the API, where
 * `vitnode.api.config.ts` already gates Redis on the same variable.
 *
 * Two slots, because Next has two caches and they are not the same one:
 *
 * - `cacheHandlers.default` backs `"use cache"`.
 * - `cacheHandler` backs the `fetch` Data Cache and the prerender store.
 *
 * Both fall back to what Next does by default if the built files are missing, so
 * a half-built workspace degrades to the in-memory and filesystem caches instead
 * of failing to boot.
 */
const redisCacheHandlers = (): NextConfig => {
  if (!process.env.REDIS_URL) return {};

  const useCache = handlerPath("use-cache-handler");
  const incremental = handlerPath("incremental-cache-handler");

  return {
    ...(useCache ? { cacheHandlers: { default: useCache } } : {}),
    ...(incremental ? { cacheHandler: incremental } : {}),
  };
};

export const vitNodeNextConfig = (config: NextConfig): NextConfig =>
  withNextIntl({
    reactCompiler: true,
    cacheComponents: true,
    partialPrefetching: true,
    ...redisCacheHandlers(),
    ...config,
    experimental: {
      turbopackMemoryEviction: "full",
      ...config.experimental,
    },
    serverExternalPackages: [...(config.serverExternalPackages ?? []), "redis"],
  });
