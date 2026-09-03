import type { vitNodeConfig } from '#/vitnode.config'

import { localeRouting } from '#/lib/i18n/runtime'

export type Locale = (typeof vitNodeConfig.i18n.locales)[number]['code']

export { defaultLocale, localeRouting } from '#/lib/i18n/runtime'

/** Narrows a string - a URL segment, a cookie, a `<select>` value - to a locale. */
export const isLocale = (value: null | string | undefined): value is Locale =>
  localeRouting.isSupportedLocale(value)
