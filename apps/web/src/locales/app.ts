import type { AppMessagesMap } from '@vitnode/core/lib/i18n/types'

/**
 * Translations this app owns, on top of whatever the packages ship.
 *
 * Empty, and that is the healthy state. A package's canonical translation
 * belongs to the package, where every installation that installs it gets the
 * language - `@vitnode/core` ships its own Polish, and so does `@vitnode/blog`.
 * Carrying a copy here is how one product came to say both "Bezpieczeństwo" and
 * "Zabezpieczenia" for the same settings tab.
 *
 * `@vitnode/blog`'s `pl.json` was the last entry, and it was here for a reason
 * that has been fixed rather than a reason that stands: it arrived from
 * `apps/docs/src/i18n.ts` when Stage 17 deleted that application, and the plugin
 * shipped no Polish of its own to fall back to. It does now
 * (`plugins/blog/src/locales/pl.json`), registered in the plugin's own locale
 * barrel and in `src/locales/packages.ts` beside its English - so the blog's
 * AdminCP copy is Polish in this app, in `apps/api`'s emails, and in anybody
 * else's installation, rather than only in this one.
 *
 * What this file is *for* is rewording: a string a package translates in a way
 * this product does not want. Add
 * `pl: { '@vitnode/blog': async () => await import('./@vitnode/blog/pl.json') }`
 * with only the keys that change - the map is deep-merged last, so everything
 * left out falls back to the package's, and then to the default locale, key by
 * key.
 *
 * Server-side only, and kept out of `src/i18n.ts` on purpose: these are
 * functions, and `src/i18n.ts` is spread into the shell config, which crosses to
 * the browser and has to stay serializable.
 */
export const appMessages: AppMessagesMap = {}
