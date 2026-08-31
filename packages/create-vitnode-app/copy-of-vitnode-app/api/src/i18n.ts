import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * The languages this installation serves.
 *
 * The API half of a split deployment. `apps/web` has a file of the same name,
 * and the two are one declaration in two places by necessity rather than by
 * design: they are separate packages, so neither can import the other's.
 *
 * They have to agree, and this is the copy that matters most - this app owns the
 * schema, so `vitnode db:prepare` seeds `core_languages` from *this* list. A
 * language that is here and not in the web app's renders nowhere; one that is in
 * the web app's and not here has no row in the database, and everything keyed on
 * a language row has nowhere to put it.
 *
 * Deliberately not discovered: nothing walks the filesystem looking for the web
 * app's config. A bootstrap that guessed at a sibling application is exactly
 * what this replaced, and it guessed wrong the moment the two were not laid out
 * the way it expected.
 *
 * Packages ship their own translations, so a new locale needs no `messages`
 * entry - anything untranslated falls back to `defaultLocale` key by key.
 */
export const i18n = {
  defaultLocale: "en",
  /**
   * Explicit, because this API renders emails on a server: without one, dates
   * format in whatever zone the host happens to run in.
   */
  timeZone: "UTC",
  locales: [
    {
      code: "en",
      name: "English",
    },
  ],
  messages: {},
} satisfies VitNodeI18nConfig;
