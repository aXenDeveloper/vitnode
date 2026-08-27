import type { searchModule } from '@vitnode/core/api/modules/search/search.module'
import type { SearchFeedParams } from '@vitnode/core/views/search/search-feed-content'

import { CONFIG_PLUGIN } from '@vitnode/core/config'
import { clientModule } from '@vitnode/core/lib/fetcher-client'

/**
 * What a Discover request *is*, with nothing about how it travels.
 *
 * Split out so the two transports - `fetcherServer` on the server,
 * `fetcherClient` in the browser - can share one definition without importing
 * each other. Both would otherwise have to spell `sort=newest&first=20&lang=…`
 * out for themselves, and the whole point of a single query definition is that
 * the two cannot drift.
 */

/** How many hits one Discover page holds. */
export const DISCOVER_FEED_PAGE_SIZE = 20

/**
 * Discover is the *browse* feed: no term, newest first. A term search is a
 * different request with a different sort, and it is not this module's.
 */
export const DISCOVER_FEED_SORT = 'newest' as const

/**
 * Discover, as the shared feed component's own parameters.
 *
 * One frozen module-level object, and both halves of the route read it: the
 * loader builds its cache key from it, and `<SearchFeedContent params={...}>`
 * is handed the very same reference. That is not a micro-optimisation - the
 * params are part of the key the component stores its pages under, so a fresh
 * object literal in the JSX and another in the loader have to hash to the same
 * entry or the component misses the loader's page and fetches it again.
 *
 * `search` is absent rather than empty: Discover browses, it does not query.
 */
export const DISCOVER_FEED_PARAMS: SearchFeedParams = Object.freeze({
  sort: DISCOVER_FEED_SORT,
})

/**
 * Where a page starts. `null` is the first one, and it is spelled as the
 * absence of a `cursor` rather than an empty one: the route's schema rejects
 * `cursor=` outright (`.min(1)`), so sending it empty would 400 the first page
 * of every visit.
 */
export type DiscoverFeedCursor = null | string

export interface DiscoverFeedPageArgs {
  cursor: DiscoverFeedCursor
  /**
   * The language the page is being rendered in. Required rather than defaulted:
   * a feed that quietly falls back to the default locale is a Polish page full
   * of English posts, and nothing about the response says so.
   */
  locale: string
}

/**
 * The search module, as a value the fetchers can carry without pulling the API
 * into either bundle.
 *
 * The module is imported as a *type* only, so the route literals, method and
 * response schema all still infer; `clientModule` supplies the one field the
 * fetcher reads at runtime. The same trick core's own `SearchFeed` uses.
 */
export const searchModuleRef = clientModule<typeof searchModule>(
  CONFIG_PLUGIN.pluginId,
)

/**
 * One page of the Discover feed, as arguments to either fetcher.
 *
 * `first` is a string because the query schema reads it off a query string;
 * `cursor` is omitted rather than set to `undefined`, so the key never reaches
 * the URL at all.
 */
export const discoverFeedRequest = ({
  cursor,
  locale,
}: DiscoverFeedPageArgs) => {
  const query: {
    cursor?: string
    first: string
    lang: string
    sort: typeof DISCOVER_FEED_SORT
  } = {
    first: String(DISCOVER_FEED_PAGE_SIZE),
    lang: locale,
    sort: DISCOVER_FEED_SORT,
  }

  if (cursor !== null) query.cursor = cursor

  return {
    args: { query },
    method: 'get' as const,
    module: 'search' as const,
    path: '/' as const,
  }
}

/**
 * Refuses a response that is not a search page.
 *
 * The fetcher hands back non-2xx responses rather than throwing on them - a
 * rejected cursor is a 400, a rate-limited visitor a 429 - and `json()` would
 * happily parse either one's `{ message }` body. Read as a page it has no
 * `edges`, so the feed renders as empty: a failure that looks exactly like a
 * community with nothing in it. Query can only retry, report or fall back to
 * the last good page if the promise actually rejects.
 *
 * A 500 never reaches here; `rawApiFetch` throws on those with the body
 * attached.
 *
 * Takes a plain `Response` so the caller keeps its typed one - passing the
 * typed response in widens `ok` to a boolean and leaves `json()` alone.
 */
export const assertDiscoverFeedResponse = (
  response: Response,
  { cursor, locale }: DiscoverFeedPageArgs,
): void => {
  if (response.ok) return

  throw new Error(
    `The search API answered ${response.status} for the Discover feed (locale "${locale}", cursor ${cursor ?? 'none'}).`,
  )
}
