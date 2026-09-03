import type { AppMessagesMap } from "@vitnode/core/lib/i18n/types";

/**
 * Translations this app owns, on top of whatever the packages ship.
 *
 * Empty, and usually stays that way. Every VitNode package ships its own
 * translations and `locales/packages.ts` is what registers them - carrying a
 * second copy of a string a package already owns is how one product comes to
 * spell the same settings tab two different ways.
 *
 * What belongs here is a string this app *changes*. Add a locale, then the key
 * you are rewording:
 *
 *     export const appMessages: AppMessagesMap = {
 *       en: {
 *         '@vitnode/core': async () => await import('./en.json'),
 *       },
 *     }
 *
 * Deep-merged last, so a file here only needs the keys it actually changes:
 * everything it leaves out falls back to the package's, and then to the default
 * locale, key by key.
 *
 * Server-side only, and kept out of `src/vitnode.config.ts` on purpose: these
 * are functions, and the shared config crosses to the browser and has to stay
 * serializable. `src/vitnode.server.config.ts` is what registers this map.
 */
export const appMessages: AppMessagesMap = {};
