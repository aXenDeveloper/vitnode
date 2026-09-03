import type { LocaleMessagesMap } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as BLOG } from '@vitnode/blog/const'
import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'
import { CONFIG_PLUGIN as EXAMPLE } from '@vitnode/example/const'

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
