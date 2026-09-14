/** Core's own id, spelled here so the generator does not import app config. */
export const CORE_PLUGIN_ID = "@vitnode/core";

/**
 * Core's locale files, in the same shape a plugin declares.
 *
 * Written out rather than discovered, for the same reason a plugin declares its
 * own: `@vitnode/core/locales/en.json` resolves because the package's `exports`
 * map says it does, and a build tool reading a directory would be guessing at
 * that. `core-locale-files.test.ts` holds it to what the package actually ships.
 *
 * Core is not a configured plugin, so this is the one entry in a generated
 * `package-messages.gen.ts` that does not depend on an app's plugin list.
 */
export const CORE_LOCALE_FILES: Record<string, string> = {
  en: "@vitnode/core/locales/en.json",
  pl: "@vitnode/core/locales/pl.json",
};
