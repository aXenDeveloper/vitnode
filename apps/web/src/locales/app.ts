import type { AppMessagesMap } from '@vitnode/core/lib/i18n/types'

import { CONFIG_PLUGIN as BLOG } from '@vitnode/blog/const'

/**
 * Translations this app owns, on top of whatever the packages ship.
 *
 * There is deliberately no `@vitnode/core` entry: VitNode's own Polish
 * translation of the pages this app renders ships with the package
 * (`packages/vitnode/src/locales/pl.json`), where every installation gets it.
 * Carrying a copy here is how one product came to say both "Bezpieczeństwo" and
 * "Zabezpieczenia" for the same settings tab.
 *
 * `@vitnode/blog` is the exception, and only because the package ships no `pl`
 * of its own yet - `locales/packages.ts` registers `en` for it and nothing else.
 * Without this file the blog's content types and their fields render as English
 * labels inside an otherwise Polish AdminCP. It came from `apps/docs/src/i18n.ts`
 * when Stage 17 deleted that application, which was the only place in the repo
 * it existed. Delete it the day `@vitnode/blog` ships `pl.json` itself, exactly
 * as core did.
 *
 * Deep-merged last, so a file here only needs the keys it actually changes:
 * everything it leaves out falls back to the package's, and then to the default
 * locale, key by key.
 *
 * Server-side only, and kept out of `src/i18n.ts` on purpose: these are
 * functions, and `src/i18n.ts` is spread into the shell config, which crosses to
 * the browser and has to stay serializable.
 */
export const appMessages: AppMessagesMap = {
  pl: {
    [BLOG.pluginId]: async () => await import('./@vitnode/blog/pl.json'),
  },
}
