import type { AppMessagesMap } from '@vitnode/core/lib/i18n/types'

/**
 * Translations this app owns, on top of whatever the packages ship.
 *
 * Empty, and that is the finished state rather than a gap: VitNode's own Polish
 * translation of the pages this app renders now ships with `@vitnode/core`
 * (`packages/vitnode/src/locales/pl.json`), where every installation gets it.
 * This map is for text that is genuinely *this installation's* - a community's
 * own name for something, a reworded call to action - and nothing here is.
 *
 * Deep-merged last, so a file added here only needs the keys it actually
 * changes: everything it leaves out falls back to the package's, and then to the
 * default locale, key by key.
 *
 *     pl: {
 *       [CORE.pluginId]: async () => await import('./@vitnode/core/pl.json'),
 *     }
 *
 * Server-side only, and kept out of `src/i18n.ts` on purpose: these are
 * functions, and `src/i18n.ts` is spread into the shell config, which crosses to
 * the browser and has to stay serializable.
 */
export const appMessages: AppMessagesMap = {}
