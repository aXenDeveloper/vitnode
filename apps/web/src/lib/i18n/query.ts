import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'

import { loadIntlMessages } from '#/server/messages.server'

import type { Locale } from './shared'

import { localeRouting } from './shared'

/** The strings every page needs, whatever else it renders. */
export const GLOBAL_NAMESPACE = 'core.global'

/**
 * Namespaces in a form two callers cannot spell differently.
 *
 * Sorted and de-duplicated, because the list is part of the query key: without
 * this, `["core.global", "core.discover"]` and `["core.discover", "core.global"]`
 * are two cache entries holding the same bytes, fetched twice and invalidated
 * separately.
 */
const normalizeNamespaces = (namespaces: readonly string[]): string[] =>
  [...new Set(namespaces)]
    .filter((namespace) => typeof namespace === 'string')
    .sort((a, b) => a.localeCompare(b))

/**
 * More than any page has ever needed, and few enough that a caller asking for
 * thousands is refused rather than served.
 */
const MAX_NAMESPACES = 16

/**
 * What the server function will accept.
 *
 * A built server function is a public endpoint, so neither argument is trusted.
 * An unknown locale degrades to the default rather than failing - a stale link
 * to a language that has since been removed should render, not 500 - but an
 * unbounded namespace list is refused, because nothing legitimate sends one.
 */
const validateIntlInput = ({
  locale,
  namespaces,
}: {
  locale: string
  namespaces: readonly string[]
}) => {
  const requested = normalizeNamespaces(namespaces)

  if (requested.length > MAX_NAMESPACES) {
    throw new Error(`At most ${MAX_NAMESPACES} namespaces may be requested.`)
  }

  return {
    locale: localeRouting.isSupportedLocale(locale)
      ? locale
      : localeRouting.defaultLocale,
    namespaces: requested,
  }
}

/**
 * One language's messages for one set of namespaces, fetched on the server.
 *
 * A server function rather than a plain loader: the messages are read from JSON
 * inside each package's `dist`, which only exists on the server, and the plugin
 * registry they are merged from must never reach the browser bundle. Start
 * strips the handler - and everything only it imports - out of the client build.
 */
export const getIntlMessages = createServerFn()
  .validator(validateIntlInput)
  .handler(async ({ data }) => await loadIntlMessages(data))

/**
 * The same request, as a query - and the only way the app should ask for it.
 *
 * The locale is a required argument and part of the key. That is the whole
 * point: two languages coexist in one QueryClient, a language switch changes the
 * key rather than the value under it, and nothing ever resolves "the current
 * locale" from inside a query function, where it would be whatever the last
 * render happened to leave behind.
 *
 * `staleTime: Infinity` - a locale's messages change when the app is redeployed.
 */
export const intlQueryOptions = ({
  locale,
  namespaces = [GLOBAL_NAMESPACE],
}: {
  locale: Locale
  namespaces?: readonly string[]
}) => {
  const normalized = normalizeNamespaces(namespaces)

  return queryOptions({
    queryFn: async () =>
      await getIntlMessages({ data: { locale, namespaces: normalized } }),
    queryKey: ['vitnode', 'intl', locale, ...normalized] as const,
    staleTime: Infinity,
  })
}
