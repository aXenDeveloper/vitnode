import type { vitNodeConfig } from '#/vitnode.config'

import { localeRouting } from '#/lib/i18n/runtime'

/**
 * A language this app serves, as a type. `"en" | "pl"`, derived from the config
 * rather than written twice.
 *
 * The one i18n thing this app still owns, and it has to: `@vitnode/core` is
 * installed by apps with different language lists, so it types a locale as
 * `string` and takes this union as a type argument where the value originates
 * (`useLocale<Locale>()`, `resolveLocale<Locale>()`).
 */
export type Locale = (typeof vitNodeConfig.i18n.locales)[number]['code']

export { defaultLocale, localeRouting } from '#/lib/i18n/runtime'

/** Narrows a string - a URL segment, a cookie, a `<select>` value - to a locale. */
export const isLocale = (value: null | string | undefined): value is Locale =>
  localeRouting.isSupportedLocale(value)
