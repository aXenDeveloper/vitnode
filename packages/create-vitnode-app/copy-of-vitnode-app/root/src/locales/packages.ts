import type { LocaleMessagesMap } from "@vitnode/core/lib/i18n/types";

import { CONFIG_PLUGIN as CORE } from "@vitnode/core/config";

/**
 * Where this app reads each installed package's translations from.
 *
 * Every VitNode package ships a locale barrel - `@vitnode/core/locales/index` -
 * that loads its own files with a runtime
 * `import("./en.json", { with: { type: "json" } })`. Under Node that is exactly
 * right, and it is how an API app reads them.
 *
 * It cannot work here, and the reason is the import attribute rather than
 * anything about VitNode. Vite and Nitro inline `@vitnode/core`'s build output
 * into this app's server chunks - `ssr.external` applies to the SSR pass, not to
 * Nitro's own bundling - but Rollup will not follow a dynamic import that
 * carries `with: { type: "json" }`, so it neither emits the JSON nor rewrites
 * the specifier. What ships is a relative import pointing next to a chunk that
 * the JSON was never copied to, and every string on the page renders as its own
 * key.
 *
 * So the loaders are declared here instead, with static specifiers a bundler can
 * follow. Each resolves through the package's `./locales/*.json` export to the
 * real file and lands in the build as a chunk fetched on demand, which is the
 * same laziness the barrels wanted.
 *
 * **Add a line here for every plugin you install.** A plugin registered in
 * `vitnode.config.ts` with no entry in this map renders its own strings as keys:
 *
 *     import { CONFIG_PLUGIN as BLOG } from '@acme/blog/const'
 *
 *     [BLOG.pluginId]: {
 *       en: async () => await import('@acme/blog/locales/en.json'),
 *     },
 *
 * This is the app's only copy of that list - `vitnode.server.config.ts` reads it
 * from here.
 */
export const packageMessages: Record<string, LocaleMessagesMap> = {
  [CORE.pluginId]: {
    en: async () => await import("@vitnode/core/locales/en.json"),
  },
};
