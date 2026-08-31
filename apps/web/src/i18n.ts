import type { VitNodeI18nConfig } from '@vitnode/core/lib/i18n/types'

/**
 * The languages this app serves.
 *
 * Its own module, the way `apps/web` has one, so the web config and (later) the
 * API config can point at the same object instead of drifting apart - the site
 * and the emails it sends have to agree on which languages exist.
 *
 * Packages ship their own translations, so nothing here lists them: `pl` has no
 * `messages` entry and falls back to `en` key by key. Add
 * `messages: { pl: { "@vitnode/core": () => import("./locales/...") } }` to
 * reword something without forking the package that owns it.
 */
export const i18n = {
  defaultLocale: 'en' as const,
  /**
   * Explicit, because the app renders on a server: without one, `use-intl`
   * formats dates in whatever zone the server happens to run in and warns that
   * the client will disagree. Stage 3, which owns the locale runtime, is where a
   * per-visitor zone would come from.
   */
  timeZone: 'UTC',
  /**
   * `as const` on each code, and nothing else: it keeps `"en" | "pl"` out of
   * the widening `satisfies` would otherwise do, which is what makes `Locale`
   * in `lib/i18n/shared.ts` a real union rather than an alias for `string`.
   */
  locales: [
    {
      code: 'en' as const,
      name: 'English',
    },
    {
      code: 'pl' as const,
      name: 'Polski',
    },
  ],
} satisfies VitNodeI18nConfig
