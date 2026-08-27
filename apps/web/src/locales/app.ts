import type { AppMessagesMap } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as CORE } from '@vitnode/core/config'

/**
 * Translations this app owns, on top of whatever the packages ship.
 *
 * Deep-merged last, so a file here only needs the keys it actually changes -
 * everything it leaves out falls back to the package's, and then to the default
 * locale, key by key. That is what makes the Polish file below legitimate at
 * five strings: the rest of the page stays English until somebody translates it,
 * rather than rendering `core.global.loading`.
 *
 * Server-side only, and kept out of `src/i18n.ts` on purpose: these are
 * functions, and `src/i18n.ts` is spread into the shell config, which crosses to
 * the browser and has to stay serializable.
 */
export const appMessages: AppMessagesMap = {
  pl: {
    [CORE.pluginId]: async () => await import('./@vitnode/core/pl.json'),
  },
}
