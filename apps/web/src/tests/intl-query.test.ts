import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Locale } from '#/lib/i18n/shared'

import {
  GLOBAL_NAMESPACE,
  intlQueryOptions,
  loadedIntlNamespaces,
} from '#/lib/i18n/query'
import { loadIntlMessages } from '#/server/messages.server'

/**
 * The query key is the whole contract between "which language is this page in"
 * and "which messages are in the cache".
 *
 * Stage 2's key was `["vitnode", "shell-intl"]` - one entry, no locale in it, so
 * switching language would have quietly served the previous one. Everything
 * below is about that not being possible again.
 */
describe('the query key names the language', () => {
  it('carries the locale', () => {
    expect(intlQueryOptions({ locale: 'pl' }).queryKey).toEqual([
      'vitnode',
      'intl',
      'pl',
      GLOBAL_NAMESPACE,
    ])
  })

  it('gives two languages two keys', () => {
    expect(intlQueryOptions({ locale: 'en' }).queryKey).not.toEqual(
      intlQueryOptions({ locale: 'pl' }).queryKey,
    )
  })

  it('carries the namespaces, so two pages do not share a cache entry', () => {
    expect(
      intlQueryOptions({
        locale: 'en',
        namespaces: ['core.global', 'core.search'],
      }).queryKey,
    ).toEqual(['vitnode', 'intl', 'en', 'core.global', 'core.search'])
  })
})

describe('namespaces are normalized before they become a key', () => {
  const keyFor = (namespaces: string[]) =>
    intlQueryOptions({ locale: 'en', namespaces }).queryKey

  it('does not care what order they were written in', () => {
    // Otherwise the same messages are fetched twice, cached twice and
    // invalidated separately.
    expect(keyFor(['core.search', 'core.global'])).toEqual(
      keyFor(['core.global', 'core.search']),
    )
  })

  it('drops duplicates', () => {
    expect(keyFor(['core.global', 'core.global'])).toEqual(
      keyFor(['core.global']),
    )
  })

  it('defaults to the global namespace', () => {
    expect(intlQueryOptions({ locale: 'en' }).queryKey).toEqual(
      keyFor([GLOBAL_NAMESPACE]),
    )
  })
})

describe('two languages live in one QueryClient at once', () => {
  /**
   * Seeded rather than fetched: `queryFn` is a server function, and Start only
   * lets one run inside a request scope. `src/tests/locale-ssr.test.ts` drives
   * the real fetch through a real request; what is being pinned here is that the
   * two languages occupy two entries and neither displaces the other.
   */
  const seed = async (queryClient: QueryClient, locale: Locale) => {
    const options = intlQueryOptions({ locale })
    const data = await loadIntlMessages({
      locale,
      namespaces: [GLOBAL_NAMESPACE],
    })
    queryClient.setQueryData(options.queryKey, data)

    return data
  }

  it('keeps both, and neither overwrites the other', async () => {
    const queryClient = new QueryClient()

    const en = await seed(queryClient, 'en')
    const pl = await seed(queryClient, 'pl')

    expect(en.messages).toHaveProperty('core.global.close', 'Close')
    expect(pl.messages).toHaveProperty('core.global.close', 'Zamknij')

    // Switching back is a cache read, not a refetch - which is what makes the
    // second language switch instant.
    expect(
      queryClient.getQueryData(intlQueryOptions({ locale: 'en' }).queryKey),
    ).toBe(en)
    expect(
      queryClient.getQueryData(intlQueryOptions({ locale: 'pl' }).queryKey),
    ).toBe(pl)
  })

  it('finds nothing under a locale that was never fetched', async () => {
    const queryClient = new QueryClient()
    await seed(queryClient, 'en')

    expect(
      queryClient.getQueryData(intlQueryOptions({ locale: 'pl' }).queryKey),
    ).toBeUndefined()
  })
})

/**
 * Which namespace sets a page is showing, answered by the cache.
 *
 * The root asks for `core.global`; a route asks for whatever it renders on top
 * (`RouteMessages`). Nothing declares the union anywhere, so a language switch -
 * which has to warm every set *before* the URL moves, or the second provider
 * suspends and the page blanks - reads it back off the entries that exist.
 */
describe('the sets a client is holding', () => {
  const clientHolding = (
    entries: { locale: Locale; namespaces?: readonly string[] }[],
  ) => {
    const queryClient = new QueryClient()

    for (const entry of entries) {
      queryClient.setQueryData(intlQueryOptions(entry).queryKey, {
        locale: entry.locale,
        messages: {},
      })
    }

    return queryClient
  }

  it('finds every set one language holds', () => {
    const queryClient = clientHolding([
      { locale: 'en' },
      { locale: 'en', namespaces: [GLOBAL_NAMESPACE, 'core.search'] },
    ])

    expect(loadedIntlNamespaces(queryClient, 'en')).toEqual([
      [GLOBAL_NAMESPACE],
      [GLOBAL_NAMESPACE, 'core.search'],
    ])
  })

  it('ignores the other languages’ entries', () => {
    const queryClient = clientHolding([
      { locale: 'en', namespaces: [GLOBAL_NAMESPACE, 'core.search'] },
      { locale: 'pl' },
    ])

    expect(loadedIntlNamespaces(queryClient, 'pl')).toEqual([
      [GLOBAL_NAMESPACE],
    ])
  })

  it('ignores everything that is not a message entry', () => {
    const queryClient = clientHolding([{ locale: 'en' }])
    queryClient.setQueryData(['search', { sort: 'newest' }, 'en'], {})

    expect(loadedIntlNamespaces(queryClient, 'en')).toEqual([
      [GLOBAL_NAMESPACE],
    ])
  })

  it('falls back to the global set on an empty cache', () => {
    // A switch made before anything has loaded still has to warm the one set
    // every page needs.
    expect(loadedIntlNamespaces(new QueryClient(), 'en')).toEqual([
      [GLOBAL_NAMESPACE],
    ])
  })
})
