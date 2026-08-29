import type { AnyRouter } from '@tanstack/react-router'
import type { SearchFeedPage } from '@vitnode/core/views/search/types'

import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
import { requestHandler } from '@tanstack/react-start/server'
import { intlQueryOptions, switchLocaleOn } from '@vitnode/core/tanstack/i18n'
import {
  DISCOVER_FEED_PARAMS,
  discoverFeedQueryKey,
  discoverFeedQueryOptions,
} from '@vitnode/core/tanstack/search'
import { searchFeedRequest } from '@vitnode/core/views/search/search-feed-query'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getRouter } from '#/router'

import { PLUGIN_ID } from './api-bridge-contract'
import { renderPage } from './start-runtime/ssr-handler'

/**
 * `/discover`, over a real request, in both languages.
 *
 * This is Stage 4's whole claim in one file. `renderPage` drives TanStack
 * Start's own request handler across the app's real route tree - the middleware
 * chain in `src/start.ts`, the locale rewrite, `beforeLoad`, the route's loader,
 * the server function that loads the messages, and React rendering to HTML - so
 * what is asserted below is what a browser would receive. The one thing stood
 * in for is the search API itself, which otherwise needs a database and a
 * populated index.
 *
 * The assertions are grouped by the promise they keep: one route for two URLs,
 * a feed already in the first byte of HTML, metadata in the request's language,
 * a cache the browser can pick up without re-fetching, and a cursor to continue
 * from.
 */

vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 })

const ORIGIN = 'https://vitnode.test'
const at = (path: string) => new URL(path, ORIGIN).href
const FEED_PATH = `/api/${PLUGIN_ID}/search`

interface RecordedRequest {
  path: string
  query: Record<string, string>
}

/** Every search call the stand-in API has been handed, oldest first. */
const recorded: RecordedRequest[] = []

/** Thirty documents: one full page of twenty, then a short second one. */
const INDEXED_IDS = Array.from({ length: 30 }, (_, index) => 30 - index)

/** The id the first page ends on, and therefore the cursor page two starts from. */
const FIRST_PAGE_END_CURSOR = 11

/**
 * The newest-first walk the search index actually performs, over a synthetic
 * index of descending row ids - and the language it was asked for, written into
 * every title.
 *
 * The language in the *content* is the point: a route that fetched the default
 * locale's feed and rendered it under a Polish heading would otherwise look
 * identical to one that got it right.
 */
const answerFeed = (query: URLSearchParams): SearchFeedPage => {
  const first = Number(query.get('first') ?? '10')
  const cursor = query.get('cursor')
  const lang = query.get('lang') ?? 'en'
  const remaining =
    cursor === null
      ? INDEXED_IDS
      : INDEXED_IDS.filter((id) => id < Number(cursor))
  const page = remaining.slice(0, first)

  return {
    edges: page.map((id) => ({
      author: null,
      authorId: null,
      containerId: null,
      containerType: null,
      content: `Body of ${lang} post ${id}`,
      createdAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      id,
      itemId: id,
      itemType: 'blog_post',
      languageCode: lang,
      metadata: {},
      pluginId: PLUGIN_ID,
      score: null,
      title: `Indexed ${lang} post ${id}`,
      url: `/blog/post-${id}`,
    })),
    pageInfo: {
      count: page.length,
      endCursor: page.at(-1) ?? null,
      hasNextPage: remaining.length > first,
      hasPreviousPage: cursor !== null,
      startCursor: page.at(0) ?? null,
      totalCount: INDEXED_IDS.length,
    },
  }
}

/** The mounted API, stood in for at the path the real search route lives on. */
const createSearchApi = () => {
  const plugin = new Hono()

  plugin.get('/search', (c) => {
    const url = new URL(c.req.url)
    recorded.push({
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
    })

    return c.json(answerFeed(url.searchParams))
  })

  // The main shell's header reads the session, so a document render asks for it
  // whether or not the page under the header cares. Answered as a guest, which
  // is what `/discover` is rendered as here - and answered at all, because a
  // fixture that 404s it is modelling an API outage rather than a page load, and
  // the header would render its placeholder for the whole document.
  const core = new Hono()
  core.get('/users/session', (c) => c.json({ ai: { models: [] }, user: null }))

  const app = new Hono().basePath('/api')
  app.route(`/${PLUGIN_ID}`, plugin)
  app.route('/@vitnode/core', core)

  return app
}

const realFetch = globalThis.fetch

/** One render, with the search calls it made. */
const renderDiscover = async (path: string) => {
  recorded.length = 0
  const page = await renderPage(at(path))

  return { ...page, requests: [...recorded] }
}

const langOf = (html: string): string | undefined =>
  /<html[^>]*\blang="([^"]*)"/.exec(html)?.[1]

const h1Of = (html: string): string | undefined =>
  /<h1[^>]*>([^<]*)</.exec(html)?.[1]

const titleOf = (html: string): string | undefined =>
  /<title[^>]*>([^<]*)</.exec(html)?.[1]

/** Everything before `</head>`, for assertions about document metadata. */
const headOf = (html: string): string => html.split('</head>')[0]

const metaOf = (html: string, name: string): string | undefined =>
  new RegExp(`<meta content="([^"]*)" name="${name}"`).exec(html)?.[1]

/**
 * The path of every href the document rendered, in order.
 *
 * Paths rather than whole hrefs, because what the assertions below are about is
 * the locale prefix, and that is a fact about the path. A search result points
 * at `/blog/post-30`, which the Next.js app still serves - so with
 * `NEXT_PUBLIC_LEGACY_WEB_URL` configured `MigrationLink` renders it absolute,
 * against the legacy origin, and without it renders it relative. Both are
 * correct, the prefix rule is the same either way, and reading whole hrefs made
 * this file's result depend on whether the developer running it had that
 * variable set.
 */
const hrefsOf = (html: string): string[] =>
  [...html.matchAll(/href="([^"]*)"/g)].flatMap(([, href]) => {
    try {
      return [new URL(href, 'https://vitnode.invalid').pathname]
    } catch {
      // Not a URL at all - `href="#"` and friends. Nothing to say about a path.
      return []
    }
  })

/**
 * Runs `handler` inside a request the way the server runtime does, so the
 * `getRequest*` helpers `fetcherServer` reads have something to read.
 *
 * A rejection is carried back out rather than swallowed: `requestHandler` turns
 * anything thrown into a 500, so a handler that failed would otherwise look to
 * the caller like one that returned nothing.
 */
const withRequest = async <T>(handler: () => Promise<T>): Promise<T> => {
  let result!: T
  let failure: undefined | { error: unknown }

  await requestHandler(async () => {
    try {
      result = await handler()
    } catch (error) {
      failure = { error }
    }

    return new Response(null, { status: 204 })
  })(new Request(at('/discover')), {})

  if (failure) throw failure.error

  return result
}

/**
 * These tests boot the whole application - React, `@vitnode/core`, the plugin
 * registry, every message file - on the first render, which under `turbo test`
 * can outlast Vitest's default timeout and say nothing about the code. The
 * warm-up pays that once.
 */
beforeAll(async () => {
  const api = createSearchApi()
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) =>
    api.fetch(new Request(input, init))

  await renderPage(at('/discover'))
})

afterAll(() => {
  globalThis.fetch = realFetch
})

describe('one route serves both public URLs', () => {
  it('has exactly one discover route in the tree', () => {
    // Not `/pl/discover.tsx` beside it: the rewrite strips the prefix before
    // matching, so a second file would be a second copy of this page to keep in
    // step. If this ever finds two, the locale has leaked into the route tree.
    const ids = Object.keys(getRouter().routesById).filter((id) =>
      id.includes('discover'),
    )

    expect(ids).toEqual(['/_main/discover'])
  })

  it('answers both URLs with the page rather than a 404', async () => {
    const [en, pl] = await Promise.all([
      renderPage(at('/discover')),
      renderPage(at('/pl/discover')),
    ])

    expect([en.status, pl.status]).toEqual([200, 200])
  })
})

describe('GET /discover renders the English feed on the server', () => {
  it('is a 200 in the default language', async () => {
    const { html, status } = await renderDiscover('/discover')

    expect(status).toBe(200)
    expect(langOf(html)).toBe('en')
  })

  it('renders the English heading and description', async () => {
    const { html } = await renderDiscover('/discover')

    expect(h1Of(html)).toBe('Discover')
    expect(html).toContain('See the latest activity across the community.')
  })

  it('renders the feed itself, not a placeholder for one', async () => {
    const { html } = await renderDiscover('/discover')

    // The whole first page, top and bottom - so a render that streamed in a
    // partial page would fail here rather than pass on the first item.
    expect(html).toContain('Indexed en post 30')
    expect(html).toContain(`Indexed en post ${FIRST_PAGE_END_CURSOR}`)
    expect(html).toContain('Body of en post 30')
    // The timeline list itself, and neither of the two things "not rendered
    // yet" looks like. The empty state is matched as *rendered text* rather
    // than as a substring: `core.search.empty` is also one of the messages
    // dehydrated into this document, so a bare `toContain` would always fail.
    expect(html).toContain('<ol class="flex flex-col">')
    expect(html).not.toContain('data-slot="skeleton"')
    expect(html).not.toMatch(/>Nothing found yet\.</)
  })

  it('asks the search API once, for the browse feed in English', async () => {
    const { requests } = await renderDiscover('/discover')

    expect(requests).toHaveLength(1)
    expect(requests.at(0)?.path).toBe(FEED_PATH)
    expect(requests.at(0)?.query).toStrictEqual({
      first: '20',
      lang: 'en',
      sort: 'newest',
    })
  })

  it('renders result links unprefixed on the unprefixed URL', async () => {
    const { html } = await renderDiscover('/discover')

    expect(hrefsOf(html)).toContain('/blog/post-30')
  })
})

describe('GET /pl/discover renders the same route in Polish', () => {
  it('is a 200 with a Polish document', async () => {
    const { html, status } = await renderDiscover('/pl/discover')

    expect(status).toBe(200)
    expect(langOf(html)).toBe('pl')
  })

  it('renders the Polish heading and description', async () => {
    const { html } = await renderDiscover('/pl/discover')

    expect(h1Of(html)).toBe('Odkrywaj')
    expect(html).toContain('Zobacz najnowszą aktywność w społeczności.')
  })

  it('asks the search API for the Polish feed', async () => {
    const { requests } = await renderDiscover('/pl/discover')

    expect(requests).toHaveLength(1)
    expect(requests.at(0)?.query.lang).toBe('pl')
  })

  it('renders the Polish feed the API answered', async () => {
    const { html } = await renderDiscover('/pl/discover')

    expect(html).toContain('Indexed pl post 30')
    expect(html).not.toContain('Indexed en post 30')
  })

  it('translates the feed’s own strings, not just the heading', async () => {
    const { html } = await renderDiscover('/pl/discover')

    // `SearchFeedContent` reads `core.search` from the provider this route
    // mounts. Getting the heading right while this stayed English would mean the
    // namespace never reached the tree.
    expect(html).toContain('Wczytaj więcej')
    expect(html).not.toContain('Load more')
  })

  it('writes the locale prefix into every result link, exactly once', async () => {
    const { html } = await renderDiscover('/pl/discover')
    const hrefs = hrefsOf(html)

    expect(hrefs).toContain('/pl/blog/post-30')
    // The router owns the prefix. A link that also added one by hand would show
    // up here, and nowhere else until somebody clicked it.
    expect(hrefs.filter((href) => href.startsWith('/pl/pl/'))).toEqual([])
  })
})

describe('the metadata is the request’s language', () => {
  it('titles the English page through the site’s own template', async () => {
    const { html } = await renderDiscover('/discover')

    expect(titleOf(html)).toBe('Discover - VitNode')
    expect(metaOf(html, 'description')).toBe(
      'See the latest activity across the community.',
    )
  })

  it('titles the Polish page in Polish', async () => {
    const { html } = await renderDiscover('/pl/discover')

    expect(titleOf(html)).toBe('Odkrywaj - VitNode')
    expect(metaOf(html, 'description')).toBe(
      'Zobacz najnowszą aktywność w społeczności.',
    )
  })

  it('leaves one title in the head, not the shell’s as well', async () => {
    const { html } = await renderDiscover('/discover')

    // Counted in the head rather than the whole document, because the document
    // legitimately holds another one: the header's logo is an inline `<svg>`,
    // and `<title>` is how an inline SVG gets an accessible name. What this
    // guards against is the route's title and the root's default *both* being
    // emitted - the failure `formatPageTitle` exists to prevent - which is a
    // question about the head.
    expect(headOf(html).match(/<title/g)).toHaveLength(1)
  })

  it('asks to be indexed and followed, in both languages', async () => {
    const [en, pl] = await Promise.all([
      renderDiscover('/discover'),
      renderDiscover('/pl/discover'),
    ])

    expect(metaOf(en.html, 'robots')).toBe('index, follow')
    expect(metaOf(pl.html, 'robots')).toBe('index, follow')
  })

  it('says the same thing in the tab title and in the heading', async () => {
    // One `createTranslator` call in the loader feeds both, so they cannot drift.
    const { html } = await renderDiscover('/pl/discover')

    expect(titleOf(html)).toContain(h1Of(html))
  })
})

/**
 * What the browser picks up.
 *
 * The dehydrated cache is inlined into the document by
 * `setupRouterSsrQueryIntegration`, so these read the payload the client will
 * hydrate from. The query *hash* is the load-bearing part: it is the entry
 * `SearchFeedContent` looks in when it mounts, and if the loader had warmed
 * anything else the feed would refetch page one on hydration - an SSR page that
 * flickers back to a skeleton in the browser.
 */
describe('the feed crosses to the browser in the cache, not as a refetch', () => {
  const feedHash = (locale: string) =>
    JSON.stringify(['search', { sort: 'newest' }, locale])

  it('dehydrates the feed under the key the shared component reads', async () => {
    const { html } = await renderDiscover('/discover')

    expect(html).toContain(JSON.stringify(feedHash('en')).slice(1, -1))
  })

  it('hands it over settled, with nothing in flight', async () => {
    const { html } = await renderDiscover('/discover')

    // `fetchStatus:"idle"` plus VitNode's `refetchOnMount: false` is the whole
    // of "the browser does not fetch this again".
    expect(html).toContain('status:"success"')
    expect(html).toContain('fetchStatus:"idle"')
  })

  it('dehydrates this route’s messages, not only the shell’s', async () => {
    const { html } = await renderDiscover('/pl/discover')

    expect(html).toContain(
      JSON.stringify(
        JSON.stringify(['vitnode', 'intl', 'pl', 'core.global', 'core.search']),
      ).slice(1, -1),
    )
  })

  it('keeps the two languages in separate entries', async () => {
    const [en, pl] = await Promise.all([
      renderDiscover('/discover'),
      renderDiscover('/pl/discover'),
    ])
    const hashOf = (html: string, locale: string) =>
      html.includes(JSON.stringify(feedHash(locale)).slice(1, -1))

    expect([hashOf(en.html, 'en'), hashOf(en.html, 'pl')]).toEqual([
      true,
      false,
    ])
    expect([hashOf(pl.html, 'en'), hashOf(pl.html, 'pl')]).toEqual([
      false,
      true,
    ])
  })

  it('renders the whole page from one request, however many components read it', async () => {
    // `RouteMessages` and `SearchFeedContent` both read what the loader fetched.
    // A second call here would mean one of them missed and fetched for itself.
    const { requests } = await renderDiscover('/pl/discover')

    expect(requests).toHaveLength(1)
  })
})

describe('the feed can be continued from where SSR left off', () => {
  it('offers a next page in the rendered document', async () => {
    const { html } = await renderDiscover('/discover')

    // The button only exists while `getNextPageParam` returns something, so this
    // is the server agreeing that a cursor survived into the page.
    expect(html).toContain('Load more')
    expect(html).toContain(`endCursor:${FIRST_PAGE_END_CURSOR}`)
    expect(html).toContain('hasNextPage:!0')
  })

  it('builds the second request from that cursor', () => {
    const { args } = searchFeedRequest({
      cursor: String(FIRST_PAGE_END_CURSOR),
      locale: 'en',
      params: DISCOVER_FEED_PARAMS,
    })

    expect(args.query.cursor).toBe(String(FIRST_PAGE_END_CURSOR))
  })

  it('fetches the second page and then stops', async () => {
    recorded.length = 0
    const queryClient = new QueryClient()

    const data = await withRequest(async () =>
      queryClient.fetchInfiniteQuery({
        ...discoverFeedQueryOptions({ locale: 'en' }),
        pages: 3,
      }),
    )

    expect(recorded.at(1)?.query.cursor).toBe(String(FIRST_PAGE_END_CURSOR))
    expect(data.pages.flatMap((page) => page.edges)).toHaveLength(30)
    // Thirty documents is two pages, so the third fetch never happens - which
    // is `getNextPageParam` reading the API's `hasNextPage`, not a page count
    // guessed from the total.
    expect(recorded).toHaveLength(2)
  })
})

/**
 * Switching language on the page itself, with no document reload.
 *
 * Driven at the router level rather than through a browser: `switchLocaleOn` is
 * written as a plain function over a router precisely so this is testable, and
 * `routerAt` builds the router the way `createStartHandler` does - the real route
 * tree, the real rewrite, a memory history seeded with a public URL.
 *
 * A request scope wraps it because the loaders reach the API through
 * `fetcherServer`, which reads the request being handled. In a browser the same
 * loaders take the client branch of the isomorphic transport instead.
 */
describe('switching language stays on the page', () => {
  const routerAt = (publicHref: string) => {
    const router = getRouter()
    router.update({
      ...router.options,
      history: createMemoryHistory({ initialEntries: [publicHref] }),
    })

    return router
  }

  const localeOf = (router: AnyRouter): string =>
    (router.state.matches.at(0)?.context as { locale?: string }).locale ?? ''

  const clientOf = (router: AnyRouter): QueryClient =>
    (router.options.context as { queryClient: QueryClient }).queryClient

  /**
   * `/discover` in English, switched to Polish, without leaving the page.
   *
   * `added` is the order cache entries appeared in, which is the only way from
   * outside to see *when* the switch warmed what. The message entries error in
   * this harness - `createServerFn` needs the Start server context that only
   * `createStartHandler` installs, and these tests drive the router directly -
   * but an entry is created either way, and the question here is ordering rather
   * than content. The SSR suite above is where the messages themselves are read.
   */
  const switchedToPolish = async () => {
    recorded.length = 0

    return withRequest(async () => {
      const router = routerAt('/discover')
      const added: string[] = []
      clientOf(router)
        .getQueryCache()
        .subscribe((event) => {
          if (event.type === 'added') added.push(event.query.queryHash)
        })

      await router.load()
      const before = [...recorded]

      await switchLocaleOn(router, 'pl')

      return { added, after: [...recorded], before, router }
    })
  }

  it('moves the public URL and leaves the matched route alone', async () => {
    const { router } = await switchedToPolish()

    expect(router.state.location.publicHref).toBe('/pl/discover')
    // Internally it never moved: `/discover` and `/pl/discover` are one route,
    // which is why the switch is an `invalidate` rather than a navigation.
    expect(router.state.location.pathname).toBe('/discover')
    expect(router.state.matches.at(-1)?.routeId).toBe('/_main/discover')
  })

  it('brings the loader context in step with the new URL', async () => {
    const { router } = await switchedToPolish()

    expect(localeOf(router)).toBe('pl')
  })

  it('fetches the feed again, in the new language', async () => {
    const { after, before } = await switchedToPolish()

    expect(before.map((request) => request.query.lang)).toEqual(['en'])
    // A different language is a different feed over different documents, so a
    // switch that reused the English pages would be the bug, not the fetch.
    expect(after.map((request) => request.query.lang)).toEqual(['en', 'pl'])
  })

  it('keeps both languages\u2019 feeds in the one client', async () => {
    const { router } = await switchedToPolish()

    expect(
      clientOf(router).getQueryData(discoverFeedQueryKey('en')),
    ).toBeDefined()
    expect(
      clientOf(router).getQueryData(discoverFeedQueryKey('pl')),
    ).toBeDefined()
  })

  it('asks for every set of the new language\u2019s messages', async () => {
    const { added } = await switchedToPolish()

    for (const namespaces of [
      ['core.global'],
      ['core.global', 'core.search'],
    ]) {
      expect(added, namespaces.join()).toContain(
        JSON.stringify(intlQueryOptions({ locale: 'pl', namespaces }).queryKey),
      )
    }
  })

  it('asks for them before the URL moves', async () => {
    // The one ordering that matters. The location store updates the moment
    // history does, so both providers re-render under the new locale while the
    // invalidated loaders are still running - and a `useSuspenseQuery` that
    // misses there blanks the page for a round trip. So `switchLocaleOn` warms
    // every set the page is holding *first*, this route's included.
    //
    // The Polish feed is the marker for "after": only the invalidated loader
    // fetches it, and that runs once the URL has moved.
    const { added } = await switchedToPolish()
    const messagesAt = added.indexOf(
      JSON.stringify(
        intlQueryOptions({
          locale: 'pl',
          namespaces: ['core.global', 'core.search'],
        }).queryKey,
      ),
    )
    const feedAt = added.indexOf(JSON.stringify(discoverFeedQueryKey('pl')))

    expect(messagesAt).toBeGreaterThanOrEqual(0)
    expect(feedAt).toBeGreaterThan(messagesAt)
  })

  it('writes the locale prefix into the links it now builds', async () => {
    const { router } = await switchedToPolish()

    expect(router.buildLocation({ to: '/discover' }).publicHref).toBe(
      '/pl/discover',
    )
  })

  it('switches back to the unprefixed URL', async () => {
    recorded.length = 0

    const router = await withRequest(async () => {
      const started = routerAt('/pl/discover')
      await started.load()
      await switchLocaleOn(started, 'en')

      return started
    })

    expect(router.state.location.publicHref).toBe('/discover')
    expect(localeOf(router)).toBe('en')
    expect(router.buildLocation({ to: '/discover' }).publicHref).toBe(
      '/discover',
    )
  })
})
