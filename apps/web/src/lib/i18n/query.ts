import type { QueryClient } from '@tanstack/react-query'

import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'

import { loadIntlMessages } from '#/server/messages.server'

import type { Locale } from './shared'

import { localeRouting } from './shared'

/** The strings every page needs, whatever else it renders. */
export const GLOBAL_NAMESPACE = 'core.global'

/** Everything a message entry's key starts with, before the language. */
const INTL_QUERY_SCOPE = ['vitnode', 'intl'] as const

/**
 * One language's slice of the message cache.
 *
 * Its own function because two things need it: the key each entry is stored
 * under, and the prefix `loadedIntlNamespaces` searches by. Spelling the prefix
 * out twice would let a search silently stop matching the keys it is looking
 * for.
 */
const intlQueryPrefix = (locale: Locale) => [...INTL_QUERY_SCOPE, locale]

/**
 * Namespaces in a form two callers cannot spell differently.
 *
 * Sorted and de-duplicated, because the list is part of the query key: without
 * this, `["core.global", "core.discover"]` and `["core.discover", "core.global"]`
 * are two cache entries holding the same bytes, fetched twice and invalidated
 * separately.
 *
 * Normalisation only - it assumes strings, and says nothing about whether they
 * are acceptable. That is {@link assertNamespace}'s job, and it runs on the
 * server where the input is untrusted.
 */
const normalizeNamespaces = (namespaces: readonly string[]): string[] =>
  [...new Set(namespaces)].sort((a, b) => a.localeCompare(b))

/**
 * More than any page has ever needed, and few enough that a caller asking for
 * thousands is refused rather than served.
 */
export const MAX_NAMESPACES = 16

/** `@vitnode/some-plugin.a.b.c` is four; nothing real goes deeper. */
export const MAX_NAMESPACE_DEPTH = 8

/** Comfortably longer than the longest plugin id plus a namespace path. */
export const MAX_NAMESPACE_LENGTH = 128

/**
 * Segments that must never reach {@link pickMessages}.
 *
 * `__proto__`, `constructor` and `prototype` are the three steps of prototype
 * pollution. `pickMessages` refuses them too - it is a shared utility and does
 * not get to assume its caller checked - but they are rejected here rather than
 * quietly dropped, because a request asking for one is not a request with a
 * typo in it.
 */
const UNSAFE_NAMESPACE_SEGMENTS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

/**
 * One namespace, or an error.
 *
 * Deliberately says *what* was wrong and not *what was sent*: the value is
 * attacker-controlled and this message ends up in a server log.
 */
const assertNamespace = (value: unknown, index: number): string => {
  const at = `namespaces[${index}]`

  if (typeof value !== 'string') throw new Error(`${at} must be a string.`)
  if (value.length === 0) throw new Error(`${at} must not be empty.`)
  if (value.length > MAX_NAMESPACE_LENGTH) {
    throw new Error(`${at} must be at most ${MAX_NAMESPACE_LENGTH} characters.`)
  }

  const segments = value.split('.')

  if (segments.length > MAX_NAMESPACE_DEPTH) {
    throw new Error(`${at} must be at most ${MAX_NAMESPACE_DEPTH} segments.`)
  }

  for (const segment of segments) {
    // `core..global`, a leading dot, a trailing dot - all malformed, and all
    // of them paths that would walk somewhere nobody meant.
    if (segment.length === 0) {
      throw new Error(`${at} must not contain an empty segment.`)
    }
    if (UNSAFE_NAMESPACE_SEGMENTS.has(segment)) {
      throw new Error(`${at} contains a forbidden segment.`)
    }
  }

  return value
}

/**
 * What the server function will accept.
 *
 * Everything below treats the argument as arriving from the network, because
 * once this app is built that is exactly what it does: a server function is a
 * public `POST` endpoint, and nothing about the client that normally calls it is
 * enforceable.
 *
 * The locale is the one field that degrades rather than fails. A stale link to a
 * language that has since been removed should still render the page in the
 * default language; being strict there would turn a config change into a 500 on
 * every old URL. A namespace, by contrast, is only ever sent by this app's own
 * code, so anything unexpected is rejected outright - filtering it away silently
 * would hide the fact that something is sending it.
 *
 * Exported for the tests: a server function cannot be invoked outside a request
 * scope, so the only way to exercise the boundary directly is to call the
 * function that guards it.
 */
export const validateIntlInput = (input: unknown) => {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Expected an object.')
  }

  const { locale, namespaces } = input as {
    locale?: unknown
    namespaces?: unknown
  }

  if (typeof locale !== 'string') throw new Error('locale must be a string.')
  if (!Array.isArray(namespaces)) {
    throw new Error('namespaces must be an array.')
  }
  // Checked before validating each entry, so a caller cannot make the server
  // walk an arbitrarily long list just to be told the list was too long.
  if (namespaces.length > MAX_NAMESPACES) {
    throw new Error(`At most ${MAX_NAMESPACES} namespaces may be requested.`)
  }

  return {
    locale: localeRouting.isSupportedLocale(locale)
      ? locale
      : localeRouting.defaultLocale,
    // `Array.from` rather than `map`: `map` skips holes in a sparse array, so
    // an entry could reach normalisation without ever being validated. This
    // visits them as `undefined`, which `assertNamespace` rejects.
    namespaces: normalizeNamespaces(Array.from(namespaces, assertNamespace)),
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
    queryKey: [...intlQueryPrefix(locale), ...normalized] as const,
    staleTime: Infinity,
  })
}

/**
 * Every namespace set a client currently holds messages for, in one language.
 *
 * Read off the cache rather than declared anywhere, and that is the point: the
 * root asks for `core.global`, a route asks for whatever it renders, and by the
 * time somebody switches language the cache is the only place that knows which
 * sets are on screen. A language switch has to warm *those* - warming only the
 * global set leaves the route's provider suspending on a key nobody fetched,
 * which blanks the page for a round trip.
 *
 * Falls back to the global set, so a switch made before anything has loaded
 * still warms the one set every page needs.
 */
export const loadedIntlNamespaces = (
  queryClient: QueryClient,
  locale: Locale,
): string[][] => {
  const prefix = intlQueryPrefix(locale)
  const sets = queryClient
    .getQueryCache()
    .findAll({ queryKey: prefix })
    .map(({ queryKey }) =>
      queryKey
        .slice(prefix.length)
        .filter((part): part is string => typeof part === 'string'),
    )
    .filter((namespaces) => namespaces.length > 0)

  return sets.length > 0 ? sets : [[GLOBAL_NAMESPACE]]
}
