import type { LocaleMessagesMap } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as BLOG } from '@vitnode/blog/const'
import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { CONFIG_PLUGIN as EXAMPLE } from '@vitnode/example/const'

/**
 * Where this app reads each installed package's translations from.
 *
 * Every VitNode package ships a locale barrel - `@vitnode/core/locales/index` -
 * that loads its own files with a runtime
 * `import("./en.json", { with: { type: "json" } })`. Under Node that is exactly
 * right, and it is how `apps/api` reads them.
 *
 * It cannot work here, and the reason is the import attribute rather than
 * anything about VitNode. Vite and Nitro inline `@vitnode/core`'s build output
 * into this app's server chunks - `ssr.external` applies to the SSR pass, not to
 * Nitro's own bundling - but Rollup will not follow a dynamic import that
 * carries `with: { type: "json" }`, so it neither emits the JSON nor rewrites
 * the specifier. What ships is a relative import pointing next to a chunk that
 * the JSON was never copied to. Swapping the barrel in and building gives:
 *
 *     [VitNode i18n] Could not load "en" messages for "@vitnode/core" -
 *     Cannot find module '.../.output/server/_chunks/en.json'
 *     Error: MISSING_MESSAGE: core.global (en)
 *
 * - a page whose every string renders as its own key. The attribute cannot
 * simply be dropped: Node refuses to import JSON without it, which would break
 * the two apps that load these barrels directly.
 *
 * So the loaders are declared here instead, with static specifiers a bundler can
 * follow. Each resolves through the package's `./locales/*.json` export to the
 * real file and lands in the build as a chunk fetched on demand, which is the
 * same laziness the barrels wanted.
 *
 * This is the app's only copy of that list - `vitnode.server.config.ts` reads it
 * from here - and the cost is one line per language a package ships. Removing it
 * means making the barrels bundler-safe (locale files as modules rather than
 * JSON, or the packages left external through Nitro), which is a packaging
 * change, not an i18n one.
 */
export const packageMessages: Record<string, LocaleMessagesMap> = {
  [BLOG.pluginId]: {
    en: async () => await import('@vitnode/blog/locales/en.json'),
    pl: async () => await import('@vitnode/blog/locales/pl.json'),
  },
  [CORE.pluginId]: {
    en: async () => await import('@vitnode/core/locales/en.json'),
    pl: async () => await import('@vitnode/core/locales/pl.json'),
  },
  [EXAMPLE.pluginId]: {
    en: async () => await import('@vitnode/example/locales/en.json'),
  },
}
