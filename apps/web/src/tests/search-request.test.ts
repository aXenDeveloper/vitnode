import { hashKey } from '@tanstack/react-query'
import { MAX_SEARCH_TERM_LENGTH } from '@vitnode/core/views/search/search-params'
import { describe, expect, it } from 'vitest'

import { discoverFeedQueryKey } from '#/lib/search/discover-feed'
import { DISCOVER_FEED_PARAMS } from '#/lib/search/discover-request'
import { feedQueryKey, feedQueryOptions } from '#/lib/search/feed'
import {
  normalizeSearchRouteSearch,
  searchRouteFeedParams,
} from '#/lib/search/search-request'

/**
 * `/search`'s contract with its own URL, and with the cache underneath it.
 *
 * Pure functions only. `normalizeSearchRouteSearch` is what the route hands to
 * `validateSearch`, so calling it directly is calling the route's schema - no
 * router, no request, no rendering. The feed's *behaviour* is core's and is
 * asserted in `packages/vitnode/src/views/search`; what is asserted here is that
 * this route asks for the right feed.
 */

const paramsFor = (input: Record<string, unknown>) =>
  searchRouteFeedParams(normalizeSearchRouteSearch(input))

const hashOf = (input: Record<string, unknown>) =>
  hashKey(feedQueryKey({ locale: 'en', params: paramsFor(input) }))

describe('the route schema reads a term out of the URL', () => {
  it('takes the term somebody searched for', () => {
    expect(normalizeSearchRouteSearch({ search: 'hono' })).toEqual({
      search: 'hono',
    })
  })

  it('trims it', () => {
    expect(normalizeSearchRouteSearch({ search: '  hono  ' })).toEqual({
      search: 'hono',
    })
  })

  it('ignores every other parameter in the query string', () => {
    // The sort and the type filters are controls, not URL state - see
    // `lib/search/search-request.ts`. A stray `?sort=` must not become one by
    // accident.
    expect(
      normalizeSearchRouteSearch({
        search: 'hono',
        sort: 'oldest',
        types: 'blog_post',
      }),
    ).toEqual({ search: 'hono' })
  })
})

describe('a malformed query string renders the page anyway', () => {
  it.each([
    ['nothing at all', {}],
    ['a bare ?search=', { search: '' }],
    ['blanks', { search: '   ' }],
    ['a repeated ?search=', { search: ['a', 'b'] }],
    ['a number', { search: 42 }],
    ['null', { search: null }],
    ['an object', { search: { toString: () => 'hono' } }],
  ])('reads %s as no term', (_case, input) => {
    // Not an error boundary and not a 404: a search page is the one page whose
    // query string is typed by strangers, so anything unusable is the browse
    // feed.
    expect(normalizeSearchRouteSearch(input)).toEqual({})
  })

  it('returns an absent key rather than an explicit undefined', () => {
    // So the router has nothing to write back into the URL, and
    // `/search?search=%20` settles as `/search`.
    expect(Object.keys(normalizeSearchRouteSearch({ search: ' ' }))).toEqual([])
  })

  it('caps a term that was never typed by hand', () => {
    const { search } = normalizeSearchRouteSearch({
      search: 'x'.repeat(MAX_SEARCH_TERM_LENGTH * 10),
    })

    expect(search).toHaveLength(MAX_SEARCH_TERM_LENGTH)
  })

  it('never throws, whatever it is handed', () => {
    for (const input of [
      {},
      { search: [] },
      { search: [[]] },
      { search: Number.NaN },
      { search: Symbol('hono') },
      { other: 'ignored' },
    ]) {
      expect(() =>
        normalizeSearchRouteSearch(input as Record<string, unknown>),
      ).not.toThrow()
    }
  })
})

describe('the feed the route asks for', () => {
  it('searches by relevance when there is a term', () => {
    expect(paramsFor({ search: 'hono' })).toEqual({
      search: 'hono',
      sort: 'relevance',
    })
  })

  it('browses newest-first when there is not', () => {
    expect(paramsFor({})).toEqual({ sort: 'newest' })
  })

  it('is the Discover feed when the box is empty', () => {
    // `/search` with nothing typed and `/discover` are the same request over the
    // same documents. Sharing the entry is the point: a visitor arriving from
    // one has the other already in hand.
    expect(paramsFor({})).toEqual(DISCOVER_FEED_PARAMS)
    expect(hashOf({})).toBe(hashKey(discoverFeedQueryKey('en')))
  })

  it('is a different entry per term', () => {
    expect(hashOf({ search: 'hono' })).not.toBe(hashOf({ search: 'drizzle' }))
  })

  it('is a different entry per language', () => {
    // `/search?search=hono` and `/pl/search?search=hono` are two feeds over two
    // sets of documents, so a language switch changes the key rather than the
    // value under it.
    expect(hashOf({ search: 'hono' })).not.toBe(
      hashKey(
        feedQueryKey({ locale: 'pl', params: paramsFor({ search: 'hono' }) }),
      ),
    )
  })

  it('is one entry however the URL spelled the term', () => {
    expect(hashOf({ search: ' hono ' })).toBe(hashOf({ search: 'hono' }))
  })
})

describe('the loader and the component read one query definition', () => {
  it('names the same cache entry from the same parameters', () => {
    // The loader ensures `feedQueryOptions({ locale, params })`; the mounted
    // `SearchFeedContent` is handed the same factory with the same parameters.
    // A mismatch here is an SSR page that renders, then refetches page one from
    // the browser and flickers back to a skeleton.
    const params = paramsFor({ search: 'hono' })

    expect(hashKey(feedQueryOptions({ locale: 'en', params }).queryKey)).toBe(
      hashKey(feedQueryKey({ locale: 'en', params })),
    )
  })

  it('starts every feed from no cursor', () => {
    // `null`, spelled as the absence of a cursor: the API's schema rejects
    // `cursor=` outright, so an empty one would 400 the first page of a visit.
    expect(
      feedQueryOptions({ locale: 'en', params: paramsFor({}) })
        .initialPageParam,
    ).toBeNull()
  })

  it('passes no initialData, because the loader warmed the entry', () => {
    // Two copies of page one - one in the cache, one in the options - can
    // disagree. The loader's copy is the only one.
    expect(
      feedQueryOptions({ locale: 'en', params: paramsFor({ search: 'hono' }) })
        .initialData,
    ).toBeUndefined()
  })
})
