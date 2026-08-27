import type { LocaleRouting } from '@vitnode/core/lib/i18n/locale-routing'

import { localeRoutingFromConfig } from '@vitnode/core/lib/i18n/locale-routing'

import { i18n } from '#/i18n'

/**
 * A language this app serves, as a type. `"en" | "pl"`, derived from the config
 * rather than written twice.
 */
export type Locale = (typeof i18n.locales)[number]['code']

/**
 * How this app's URLs carry a language, and the only place that decides it.
 *
 * Pure string transforms, built from `src/i18n.ts` - no `Request`, no cookies,
 * no router, no `window`. That is what lets the same rules run in four places
 * that cannot import each other's runtimes: the server middleware that
 * canonicalises incoming URLs, the router rewrite that hides the prefix from the
 * route tree, the language switcher in the browser, and the tests.
 *
 * `/admin` and `/api` are outside all of it - see `DEFAULT_IGNORED_LOCALE_PATHS`
 * in core for why - and this app takes that default as-is.
 */
export const localeRouting: LocaleRouting = localeRoutingFromConfig(i18n)

export const { defaultLocale } = localeRouting

/** Narrows a string - a URL segment, a cookie, a `<select>` value - to a locale. */
export const isLocale = (value: null | string | undefined): value is Locale =>
  localeRouting.isSupportedLocale(value)
