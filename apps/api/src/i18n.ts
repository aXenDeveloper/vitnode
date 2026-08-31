import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * The languages this installation serves.
 *
 * This API and `apps/web` are two halves of one installation - the same
 * Postgres, the same `core_languages` - and this app is the half that owns the
 * schema, so `vitnode db:prepare` seeds the database from *this* list. That is
 * why it is spelled out rather than left empty: the bootstrap used to look for
 * the web app's `src/vitnode.config.ts` by walking the filesystem, never found
 * it from here, and seeded `en` alone into a database serving `en` and `pl`.
 * The API config is now the only thing it reads.
 *
 * It must stay in step with `apps/web/src/i18n.ts`, and
 * `apps/web/src/tests/installation-locales.test.ts` fails if the two drift.
 * A generated split deployment has the same obligation and the same shape: two
 * apps, one declaration each, and no filesystem discovery between them.
 *
 * Packages ship their own translations, so nothing here lists them - a locale
 * with no `messages` entry falls back to `defaultLocale` key by key.
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
    {
      code: "pl",
      name: "Polski",
    },
  ],
  messages: {},
} satisfies VitNodeI18nConfig;
