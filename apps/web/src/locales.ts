import type { LocaleMessagesMap } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as BLOG } from '@vitnode/blog/const'
import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { CONFIG_PLUGIN as EXAMPLE } from '@vitnode/example/const'

/**
 * Where this app reads each installed package's translations from.
 *
 * Every VitNode package ships a locale barrel - `@vitnode/core/locales/index` -
 * that loads its own files with a runtime
 * `import("./en.json", { with: { type: "json" } })`. That is exactly right under
 * Node, which is how `apps/api` and `apps/docs` read them, and unusable here: a
 * bundler resolves that specifier relative to whichever chunk the barrel ended up
 * in, the JSON is not next to it, and the built server silently loads nothing -
 * every string renders as its own key.
 *
 * So the loaders are declared here instead, with static specifiers a bundler can
 * follow. Each resolves through the package's `./locales/*.json` export to the
 * real file and lands in the build as a chunk fetched on demand, which is the
 * same laziness the barrels wanted.
 *
 * The cost is a line here per language a package ships. `apps/docs` already
 * declares its own overrides this way, so the shape is not new - but it is a
 * copy, and worth removing: make the barrels statically analysable and this file
 * becomes one call to `buildMessagesSources`.
 */
export const packageMessages: Record<string, LocaleMessagesMap> = {
  [BLOG.pluginId]: {
    en: async () => await import('@vitnode/blog/locales/en.json'),
  },
  [CORE.pluginId]: {
    en: async () => await import('@vitnode/core/locales/en.json'),
  },
  [EXAMPLE.pluginId]: {
    en: async () => await import('@vitnode/example/locales/en.json'),
  },
}
