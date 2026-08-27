import type { SearchFeedPage } from '@vitnode/core/views/search/types'

import { hashKey, QueryClient } from '@tanstack/react-query'
import { requestHandler } from '@tanstack/react-start/server'
import { searchFeedQueryKey } from '@vitnode/core/views/search/search-feed-content'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DISCOVER_FEED_FIRST_PAGE,
  discoverFeedQueryKey,
  discoverFeedQueryOptions,
  fetchDiscoverFeedPageInBrowser,
  nextDiscoverFeedCursor,
} from '#/lib/search/discover-feed'
import {
  DISCOVER_FEED_PAGE_SIZE,
  DISCOVER_FEED_PARAMS,
  discoverFeedRequest,
} from '#/lib/search/discover-request'
import { fetchDiscoverFeedPageOnServer } from '#/server/discover-feed.server'

import { PLUGIN_ID } from './api-bridge-contract'

const WEB_ORIGIN = 'https://web.test'
const FEED_PATH = `/api/${PLUGIN_ID}/search`

/**
 * The Discover feed's data layer, which is the whole of Stage 4's contract with
 * the route that will render it: one query definition, keyed by language,
 * reaching the same Hono API from a loader and from the browser.
 *
 * Everything here is stated about the query and its two transports; nothing
 * renders. What the feed *looks like* is `SearchFeedContent`'s business.
 */

interface RecordedRequest {
  headers: Record<string, string>
  path: string
  query: Record<string, string>
}

/**
 * The newest-first walk the search index actually performs, over a synthetic
 * index of descending row ids.
 *
 * Real rather than scripted, because the cursor is the part that has to be
 * right: `newest` orders by id descending and continues from `endCursor` by
 * taking rows *below* it, so a fixture that ignored the cursor would answer page
 * one twice and the pagination test would still pass.
 */
const answerFeed = (ids: number[], query: URLSearchParams): SearchFeedPage => {
  const first = Number(query.get('first') ?? '10')
  const cursor = query.get('cursor')
  const remaining =
    cursor === null ? ids : ids.filter((id) => id < Number(cursor))
  const page = remaining.slice(0, first)

  return {
    edges: page.map((id) => ({
      author: null,
      authorId: null,
      containerId: null,
      containerType: null,
      content: `Content ${id}`,
      createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      id,
      itemId: id,
      itemType: 'blog_post',
      languageCode: query.get('lang') ?? 'en',
      metadata: {},
      pluginId: PLUGIN_ID,
      score: null,
      title: `Post ${id}`,
      url: `/blog/${id}`,
    })),
    pageInfo: {
      count: page.length,
      endCursor: page.at(-1) ?? null,
      hasNextPage: remaining.length > first,
      hasPreviousPage: cursor !== null,
      startCursor: page.at(0) ?? null,
      totalCount: ids.length,
    },
  }
}

/** Thirty documents: one full page of twenty, then a short second one. */
const INDEXED_IDS = Array.from({ length: 30 }, (_, index) => 30 - index)

/**
 * A stand-in for the mounted API, at the path the real search route lives on.
 * `status` lets a test make it answer the way a rejected cursor or a
 * rate-limited visitor would.
 */
const createSearchApi = (
  recorded: RecordedRequest[],
  { ids = INDEXED_IDS, status = 200 }: { ids?: number[]; status?: number } = {},
) => {
  const plugin = new Hono()

  plugin.get('/search', (c) => {
    const url = new URL(c.req.url)
    recorded.push({
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
    })

    if (status !== 200) {
      return c.json({ message: 'Invalid cursor.' }, 400)
    }

    return c.json(answerFeed(ids, url.searchParams))
  })

  const app = new Hono().basePath('/api')
  app.route(`/${PLUGIN_ID}`, plugin)

  return app
}

/**
 * Runs `handler` inside a request the way the server runtime does, so the
 * `getRequest*` helpers `fetcherServer` reads have something to read.
 *
 * A rejection is carried back out rather than left inside: `requestHandler`
 * turns anything thrown into a 500 response, so a handler that failed would
 * otherwise look to the caller like one that returned nothing.
 */
const withRequest = async <T>(
  init: { headers?: Record<string, string> },
  handler: () => Promise<T> | T,
): Promise<T> => {
  let result!: T
  let failure: undefined | { error: unknown }

  await requestHandler(async () => {
    try {
      result = await handler()
    } catch (error) {
      failure = { error }
    }

    return new Response(null, { status: 204 })
  })(new Request(`${WEB_ORIGIN}/discover`, init), {})

  if (failure) throw failure.error

  return result
}

/** A page with whatever `pageInfo` a test is asking about. */
const pageWith = (pageInfo: Partial<SearchFeedPage['pageInfo']>) =>
  ({
    edges: [],
    pageInfo: {
      count: 0,
      endCursor: null,
      hasNextPage: false,
      hasPreviousPage: false,
      startCursor: null,
      totalCount: 0,
      ...pageInfo,
    },
  }) satisfies SearchFeedPage

describe('the query key names the language', () => {
  it('carries the locale', () => {
    expect(discoverFeedQueryOptions({ locale: 'pl' }).queryKey).toEqual([
      'search',
      { sort: 'newest' },
      'pl',
    ])
  })

  it('gives two languages two keys', () => {
    expect(discoverFeedQueryOptions({ locale: 'en' }).queryKey).not.toEqual(
      discoverFeedQueryOptions({ locale: 'pl' }).queryKey,
    )
  })

  /**
   * The integration invariant, and the reason this key is not this app's own.
   *
   * `SearchFeedContent` runs the mounted `useInfiniteQuery` and stores its pages
   * under `searchFeedQueryKey`. If the loader warmed anything else, the
   * component would mount, miss, and fetch page one from the browser - an SSR
   * skeleton followed by a client fetch, which is exactly what warming the cache
   * was for. So this asserts the two are one key rather than two that look alike.
   */
  it('is the entry the shared feed component itself reads', () => {
    expect(discoverFeedQueryKey('pl')).toEqual(
      searchFeedQueryKey({ locale: 'pl', params: DISCOVER_FEED_PARAMS }),
    )
  })

  it('hashes the same on every call, params object and all', () => {
    // Query compares keys by a stable hash rather than by identity, so an object
    // in the key is safe - but only while it holds the same values. One frozen
    // module-level `DISCOVER_FEED_PARAMS` is what guarantees that.
    expect(hashKey(discoverFeedQueryKey('en'))).toBe(
      hashKey(discoverFeedQueryKey('en')),
    )
    expect(hashKey(discoverFeedQueryKey('en'))).not.toBe(
      hashKey(discoverFeedQueryKey('pl')),
    )
  })
})

describe('the request is the browse feed', () => {
  it('asks for the newest twenty in one language, with no cursor', () => {
    const { args } = discoverFeedRequest({
      cursor: DISCOVER_FEED_FIRST_PAGE,
      locale: 'en',
    })

    expect(args.query).toStrictEqual({
      first: '20',
      lang: 'en',
      sort: 'newest',
    })
    // Not `cursor: undefined`: the route's schema rejects an empty cursor
    // outright, so the key must not reach the URL at all.
    expect('cursor' in args.query).toBe(false)
  })

  it('continues from the cursor on the next page', () => {
    const { args } = discoverFeedRequest({ cursor: '11', locale: 'pl' })

    expect(args.query).toStrictEqual({
      cursor: '11',
      first: '20',
      lang: 'pl',
      sort: 'newest',
    })
  })

  it('reaches the search route the API actually registers', () => {
    const request = discoverFeedRequest({ cursor: null, locale: 'en' })

    expect(request.method).toBe('get')
    expect(request.module).toBe('search')
    expect(request.path).toBe('/')
  })

  it('names a page size the pagination schema accepts', () => {
    expect(DISCOVER_FEED_PAGE_SIZE).toBe(20)
    expect(String(DISCOVER_FEED_PAGE_SIZE)).toMatch(/^\d+$/)
  })
})

describe('pagination ends where the API says it does', () => {
  it('continues from endCursor while there is a next page', () => {
    expect(
      nextDiscoverFeedCursor(pageWith({ endCursor: 11, hasNextPage: true })),
    ).toBe('11')
  })

  it('stops when the API reports no next page', () => {
    // `undefined` is what turns "load more" off - Query reads `hasNextPage` as
    // "getNextPageParam returned something".
    expect(
      nextDiscoverFeedCursor(pageWith({ endCursor: 11, hasNextPage: false })),
    ).toBeUndefined()
  })

  it('stops when there is no row to continue from', () => {
    // The newest-first walk cursors by row id; asking again with no id would
    // replay page one forever.
    expect(
      nextDiscoverFeedCursor(pageWith({ endCursor: null, hasNextPage: true })),
    ).toBeUndefined()
  })

  it('is the rule the query definition itself uses', () => {
    const { getNextPageParam, initialPageParam } = discoverFeedQueryOptions({
      locale: 'en',
    })

    expect(getNextPageParam).toBe(nextDiscoverFeedCursor)
    expect(initialPageParam).toBeNull()
  })
})

describe('the feed over the API', () => {
  let recorded: RecordedRequest[]
  const realFetch = globalThis.fetch

  const mountApi = (options?: { ids?: number[]; status?: number }) => {
    const api = createSearchApi(recorded, options)
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
      api.fetch(new Request(input, init))
  }

  beforeEach(() => {
    recorded = []
    // The browser fetcher has no request to read an origin off, so it falls
    // back to the configured one - which the in-process API below answers.
    process.env.NEXT_PUBLIC_API_URL = WEB_ORIGIN
    mountApi()
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  describe('SSR goes through the server fetcher', () => {
    it('sends the browse query', async () => {
      await withRequest({}, async () =>
        fetchDiscoverFeedPageOnServer({ cursor: null, locale: 'pl' }),
      )

      expect(recorded.at(0)?.path).toBe(FEED_PATH)
      expect(recorded.at(0)?.query).toStrictEqual({
        first: '20',
        lang: 'pl',
        sort: 'newest',
      })
    })

    it('carries the request context the API reads', async () => {
      await withRequest(
        {
          headers: {
            cookie: 'vitnode_device=d3v1c3',
            'user-agent': 'Mozilla/5.0 (SSR test)',
            'x-forwarded-for': '203.0.113.7',
          },
        },
        async () =>
          fetchDiscoverFeedPageOnServer({ cursor: null, locale: 'en' }),
      )

      // Which is what makes this the *server* fetcher: without these, every SSR
      // render shares one rate-limit bucket and logs this server's own IP.
      expect(recorded.at(0)?.headers).toMatchObject({
        cookie: 'vitnode_device=d3v1c3',
        'user-agent': 'Mozilla/5.0 (SSR test)',
        'x-forwarded-for': '203.0.113.7',
      })
    })

    it('returns the page the API answered', async () => {
      const page = await withRequest({}, async () =>
        fetchDiscoverFeedPageOnServer({ cursor: null, locale: 'en' }),
      )

      expect(page.edges).toHaveLength(20)
      expect(page.pageInfo.hasNextPage).toBe(true)
      expect(page.pageInfo.endCursor).toBe(11)
    })

    it('treats an empty feed as a page, not a failure', async () => {
      mountApi({ ids: [] })

      const page = await withRequest({}, async () =>
        fetchDiscoverFeedPageOnServer({ cursor: null, locale: 'en' }),
      )

      expect(page.edges).toEqual([])
      expect(nextDiscoverFeedCursor(page)).toBeUndefined()
    })

    it('rejects a failed response instead of reading it as a page', async () => {
      mountApi({ status: 400 })

      // The fetcher hands non-2xx back rather than throwing, and `{ message }`
      // read as a page has no `edges` - so without this the feed renders as
      // empty and nothing anywhere says the request failed.
      await expect(
        withRequest({}, async () =>
          fetchDiscoverFeedPageOnServer({ cursor: 'nope', locale: 'en' }),
        ),
      ).rejects.toThrow('400')
    })
  })

  describe('the browser goes through the client fetcher', () => {
    it('sends the same browse query', async () => {
      await fetchDiscoverFeedPageInBrowser({ cursor: null, locale: 'en' })

      expect(recorded.at(0)?.path).toBe(FEED_PATH)
      expect(recorded.at(0)?.query).toStrictEqual({
        first: '20',
        lang: 'en',
        sort: 'newest',
      })
    })

    it('continues from a cursor', async () => {
      await fetchDiscoverFeedPageInBrowser({ cursor: '11', locale: 'en' })

      expect(recorded.at(0)?.query.cursor).toBe('11')
    })

    it('leaves the request context to the browser', async () => {
      await withRequest(
        { headers: { cookie: 'vitnode_device=d3v1c3' } },
        async () =>
          fetchDiscoverFeedPageInBrowser({ cursor: null, locale: 'en' }),
      )

      // Even called from inside a request scope it forwards nothing: a real
      // browser attaches its own cookies to a same-origin call, and a client
      // fetcher that read them off the server's request would be the server one.
      expect(recorded.at(0)?.headers.cookie).toBeUndefined()
    })

    it('rejects a failed response instead of reading it as a page', async () => {
      mountApi({ status: 400 })

      await expect(
        fetchDiscoverFeedPageInBrowser({ cursor: 'nope', locale: 'en' }),
      ).rejects.toThrow('400')
    })
  })

  describe('a QueryClient warms and walks the feed', () => {
    it('lets a loader ensure the first page', async () => {
      const queryClient = new QueryClient()
      const options = discoverFeedQueryOptions({ locale: 'en' })

      const data = await withRequest({}, async () =>
        queryClient.ensureInfiniteQueryData(options),
      )

      expect(data.pages).toHaveLength(1)
      expect(data.pageParams).toEqual([null])
      expect(queryClient.getQueryData(options.queryKey)).toBe(data)
      // One request, not two: the component reads the loader's page back out of
      // the cache rather than fetching it again.
      expect(recorded).toHaveLength(1)
    })

    it('asks for the second page with the first page cursor', async () => {
      const queryClient = new QueryClient()
      const options = discoverFeedQueryOptions({ locale: 'en' })

      const data = await withRequest({}, async () =>
        queryClient.fetchInfiniteQuery({ ...options, pages: 2 }),
      )

      expect(recorded.at(0)?.query.cursor).toBeUndefined()
      expect(recorded.at(1)?.query).toStrictEqual({
        cursor: '11',
        first: '20',
        lang: 'en',
        sort: 'newest',
      })
      expect(data.pages.flatMap((page) => page.edges)).toHaveLength(30)
      expect(data.pageParams).toEqual([null, '11'])
    })

    it('stops after the last page', async () => {
      const queryClient = new QueryClient()
      const options = discoverFeedQueryOptions({ locale: 'en' })

      const data = await withRequest({}, async () =>
        queryClient.fetchInfiniteQuery({ ...options, pages: 3 }),
      )

      // The index holds thirty documents, so page two ends the feed - the third
      // fetch never happens.
      expect(recorded).toHaveLength(2)
      expect(data.pages).toHaveLength(2)
      expect(nextDiscoverFeedCursor(data.pages[1])).toBeUndefined()
    })

    it('keeps two languages in one client at once', async () => {
      const queryClient = new QueryClient()

      await withRequest({}, async () => {
        await queryClient.ensureInfiniteQueryData(
          discoverFeedQueryOptions({ locale: 'en' }),
        )
        await queryClient.ensureInfiniteQueryData(
          discoverFeedQueryOptions({ locale: 'pl' }),
        )
      })

      expect(recorded.map((request) => request.query.lang)).toEqual([
        'en',
        'pl',
      ])
      expect(queryClient.getQueryData(discoverFeedQueryKey('en'))).toBeDefined()
      expect(queryClient.getQueryData(discoverFeedQueryKey('pl'))).toBeDefined()
    })

    it('does not carry one request feed into the next', async () => {
      // A server-side client is created per request; a shared one would serve
      // the feed rendered for one visitor to the next.
      const first = new QueryClient()
      const options = discoverFeedQueryOptions({ locale: 'en' })

      await withRequest({}, async () => first.ensureInfiniteQueryData(options))

      const second = new QueryClient()

      expect(first.getQueryData(options.queryKey)).toBeDefined()
      expect(second.getQueryData(options.queryKey)).toBeUndefined()
    })
  })
})
