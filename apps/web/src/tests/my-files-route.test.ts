import { hashKey, QueryClient } from '@tanstack/react-query'
import { defaultParseSearch } from '@tanstack/react-router'
import {
  DEFAULT_TABLE_PAGE_SIZE,
  toggleTableOrder,
  withTablePage,
  withTablePageSize,
  withTableSearch,
} from '@vitnode/core/components/table/url-state'
import {
  MY_FILES_MAX_PAGE_SIZE,
  myFilesQueryRoot,
} from '@vitnode/core/views/files/my-files-query'
import { describe, expect, it } from 'vitest'

import { invalidateMyFiles, myFilesQuery } from '#/lib/files/my-files'
import {
  myFilesRouteParams,
  myFilesSearchFrom,
  myFilesSearchParams,
  normalizeMyFilesRouteSearch,
} from '#/lib/files/my-files-route'
import { isTanStackOwnedPath } from '#/lib/migration-navigation'
import { getRouter } from '#/router'

/**
 * `/files`'s contract with its own URL, and with the cache underneath it.
 *
 * Pure functions only. `normalizeMyFilesRouteSearch` is what the route hands to
 * `validateSearch`, so calling it directly is calling the route's schema - no
 * router, no request, no rendering. The *meaning* of a files request is core's
 * and is asserted in `packages/vitnode/src/views/files/my-files-query.test.ts`;
 * what is asserted here is that this route asks for the right one, that a table
 * control's URL survives the round trip through it, and that a delete
 * invalidates the right family and nothing else.
 */

/**
 * The route's schema, over a query string as a visitor would type it.
 *
 * Through the router's *own* parser rather than `URLSearchParams`, because what
 * reaches `validateSearch` is not a query string and not even strings: the
 * default parser turns `?first=20` into the number `20`, `?x=true` into a
 * boolean, and a repeated key into an array. Half the rules below exist for
 * exactly that, so a test that flattened it first would be testing something
 * else.
 */
const searchFor = (query: string) =>
  normalizeMyFilesRouteSearch(defaultParseSearch(query))

/** The visitor these tests are signed in as, wherever an owner is needed. */
const USER = 10

/** Another visitor, for the entries that must never be shared with them. */
const OTHER_USER = 20

/** The cache entry one URL lands in, for one visitor. */
const keyFor = (query: string, userId: number = USER) =>
  hashKey(
    myFilesQuery({ params: myFilesRouteParams(searchFor(query)), userId })
      .queryKey,
  )

describe('the route schema reads a table request out of the URL', () => {
  it('is nothing at all for the page with no query string', () => {
    // `/files` is the canonical address of this page. A schema that answered
    // `{ first: 10 }` here would write `?first=10` into every link the router
    // builds to it - including the one a guest's `?returnTo=` comes back through.
    expect(searchFor('')).toEqual({})
  })

  it('takes the six parameters the table writes', () => {
    expect(
      searchFor(
        'search=logo&orderBy=name&order=asc&first=20&cursor=eyJpZCI6MX0',
      ),
    ).toEqual({
      cursor: 'eyJpZCI6MX0',
      first: 20,
      order: 'asc',
      orderBy: 'name',
      search: 'logo',
    })
  })

  it('carries no parameter this route does not have', () => {
    // Rule 3: nothing a visitor puts in the query string is accepted unless the
    // route asked for it. `?tab=` is not validated, not carried, and not sent.
    expect(searchFor('orderBy=name&tab=2&utm_source=x&__proto__=y')).toEqual({
      orderBy: 'name',
    })
  })

  it('spells the default page size as saying nothing', () => {
    expect(searchFor(`first=${DEFAULT_TABLE_PAGE_SIZE}`)).toEqual({})
    expect(searchFor('first=20')).toEqual({ first: 20 })
  })

  it('keeps a backwards page of the default size, which is not the same request', () => {
    // `last` says *which direction*, so it survives at a size `first` would not.
    expect(
      searchFor(`last=${DEFAULT_TABLE_PAGE_SIZE}&cursor=eyJpZCI6MX0`),
    ).toEqual({
      cursor: 'eyJpZCI6MX0',
      last: DEFAULT_TABLE_PAGE_SIZE,
    })
  })

  it('reads the numbers the router has already parsed', () => {
    // `?first=20` reaches `validateSearch` as a number and `?search=1` as one
    // too, while core's normaliser is written against a query string, where
    // everything is a string. Without the coercion in between, `search.trim()`
    // throws inside the schema and a perfectly ordinary search becomes a router
    // error screen.
    expect(searchFor('first=20&search=1')).toEqual({ first: 20, search: '1' })
  })

  it('takes the first value when a key is repeated', () => {
    expect(searchFor('orderBy=name&orderBy=size')).toEqual({ orderBy: 'name' })
  })
})

describe('a query string typed by hand renders the table anyway', () => {
  it.each([
    ['an unknown sort column', 'orderBy=password'],
    ['a sort direction that is not one', 'order=sideways'],
    ['a page size that is not a number', 'first=abc'],
    ['an empty page size', 'first='],
    ['a page size of zero', 'first=0'],
    ['a negative page size', 'first=-5'],
    ['a fractional page size', 'first=10.5'],
    ['a cursor that cannot be one', 'cursor=%F0%9F%92%A5'],
    ['a search of nothing but blanks', 'search=%20%20'],
  ])('renders the default table for %s', (_case, query) => {
    // Not an error screen, and not a 400 from the API: an unusable value becomes
    // an absent one, so an unrecognised `orderBy` falls back to the list's own
    // `createdAt desc` rather than being sent.
    expect(searchFor(query)).toEqual({})
    expect(keyFor(query)).toBe(keyFor(''))
  })

  it('clamps a page size past what the API will serve rather than 400ing', () => {
    expect(searchFor('first=5000')).toEqual({ first: MY_FILES_MAX_PAGE_SIZE })
  })

  it('never asks for both directions at once, which the API refuses', () => {
    const search = searchFor('first=20&last=20')

    expect(search.first).toBe(20)
    expect(search.last).toBeUndefined()
  })

  it('settles rather than drifting when applied to its own output', () => {
    // The schema runs twice on every navigation - once on the query string a
    // control produced, once more when the router validates the location that
    // makes. A rule that moved the value on the second pass would drift a step
    // per click.
    for (const query of [
      '',
      'first=10',
      'first=5000',
      'orderBy=name&order=desc',
      'search=%20logo%20',
    ]) {
      const once = searchFor(query)

      expect(normalizeMyFilesRouteSearch(once)).toEqual(once)
    }
  })
})

describe('the request the URL is asking for', () => {
  it('always names a page size, because a request must', () => {
    // The URL need not, and does not - see above. The default is applied here,
    // where the query key can see it, rather than inside the URL builder.
    expect(myFilesRouteParams(searchFor(''))).toEqual({
      first: String(DEFAULT_TABLE_PAGE_SIZE),
    })
  })

  it('sends the sort the URL asked for', () => {
    expect(myFilesRouteParams(searchFor('orderBy=size&order=asc'))).toEqual({
      first: String(DEFAULT_TABLE_PAGE_SIZE),
      order: 'asc',
      orderBy: 'size',
    })
  })

  it('ignores whatever else the router merged into the search', () => {
    // The router merges a route's validated search over the *raw* parsed one, so
    // `Route.useSearch()` still carries the rest of the query string. Going back
    // through the same normalisation is what makes the request depend on the six.
    expect(myFilesRouteParams({ orderBy: 'name', tab: '2' })).toEqual(
      myFilesRouteParams({ orderBy: 'name' }),
    )
  })
})

describe('one URL, one cache entry', () => {
  it('is the same entry for two spellings of the same request', () => {
    expect(keyFor(`first=${DEFAULT_TABLE_PAGE_SIZE}`)).toBe(keyFor(''))
    expect(keyFor('search=logo')).toBe(keyFor('search=%20logo%20'))
    expect(keyFor('orderBy=name&tab=2')).toBe(keyFor('orderBy=name'))
  })

  it('is a different entry for everything that changes the rows', () => {
    const keys = [
      keyFor(''),
      keyFor('first=20'),
      keyFor('orderBy=name'),
      keyFor('orderBy=name&order=asc'),
      keyFor('search=logo'),
      keyFor('cursor=eyJpZCI6MX0'),
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('hangs off the root a delete invalidates', () => {
    const root = myFilesQueryRoot(USER)

    expect(
      myFilesQuery({
        params: myFilesRouteParams({}),
        userId: USER,
      }).queryKey.slice(0, root.length),
    ).toEqual([...root])
  })

  /**
   * The privacy invariant at this route's own seam.
   *
   * The key contract is core's and is asserted there; what is asserted here is
   * that *this route's* query definition carries the owner through, so the entry
   * a loader fills for one visitor cannot be the entry another visitor's loader
   * reads. Same URL, same normalised parameters, two visitors, two entries.
   */
  it('gives two visitors two entries for the identical URL', () => {
    for (const query of ['', 'orderBy=name&order=asc', 'search=logo']) {
      expect(keyFor(query, USER)).not.toBe(keyFor(query, OTHER_USER))
    }
  })
})

describe('the table changes the URL through the route, not around it', () => {
  /** One control's click: read the URL, rewrite it, hand it back to the route. */
  const afterControl = (
    query: string,
    control: (search: URLSearchParams) => string,
  ) => myFilesSearchFrom(control(myFilesSearchParams(searchFor(query))))

  const defaultOrder = { column: 'createdAt', order: 'desc' } as const

  it('hands the controls the validated search and nothing else', () => {
    expect(
      myFilesSearchParams(searchFor('orderBy=name&tab=2')).toString(),
    ).toBe('orderBy=name')
    expect(myFilesSearchParams(searchFor('')).toString()).toBe('')
  })

  it('sorts a column the table offers', () => {
    expect(
      afterControl('', (search) =>
        toggleTableOrder(search, { column: 'name', defaultOrder }),
      ),
    ).toEqual({ order: 'asc', orderBy: 'name' })
  })

  it('flips a column that is already ascending', () => {
    expect(
      afterControl('orderBy=name&order=asc', (search) =>
        toggleTableOrder(search, { column: 'name', defaultOrder }),
      ),
    ).toEqual({ order: 'desc', orderBy: 'name' })
  })

  it('cannot write a sort column this route does not have', () => {
    // The return leg re-validates, so a control - or a plugin handing one a
    // column list of its own - cannot put a column in the URL that the API would
    // 400 on. The *direction* survives, and deliberately: `order` alone is what
    // the list route reads as its own default column in that direction
    // (`orderBy: query.orderBy ? ... : core_files.createdAt`), and the Next.js
    // page produces exactly the same URL from the same click. One contract, two
    // frameworks - not two normalisations that agree until they don't.
    expect(
      afterControl('', (search) =>
        toggleTableOrder(search, { column: 'password', defaultOrder }),
      ),
    ).toEqual({ order: 'asc' })
  })

  it('pages forwards from the cursor the API handed back', () => {
    expect(
      afterControl('orderBy=name&order=asc', (search) =>
        withTablePage(search, {
          cursor: 'eyJpZCI6MX0',
          direction: 'next',
          pageSize: DEFAULT_TABLE_PAGE_SIZE,
        }),
      ),
    ).toEqual({
      cursor: 'eyJpZCI6MX0',
      order: 'asc',
      orderBy: 'name',
    })
  })

  it('pages backwards, and says so', () => {
    expect(
      afterControl('cursor=eyJpZCI6OX0', (search) =>
        withTablePage(search, {
          cursor: 'eyJpZCI6MX0',
          direction: 'previous',
          pageSize: DEFAULT_TABLE_PAGE_SIZE,
        }),
      ),
    ).toEqual({ cursor: 'eyJpZCI6MX0', last: DEFAULT_TABLE_PAGE_SIZE })
  })

  it('changes the page size as a number, so the URL says `first=20`', () => {
    // A *string* `'20'` is written to the address bar as `first=%2220%22` by
    // TanStack Router's default serializer, which is neither what the Next.js
    // page produces nor what a person pastes into a browser.
    expect(afterControl('', (search) => withTablePageSize(search, 20))).toEqual(
      {
        first: 20,
      },
    )
  })

  it('returns the default page size to saying nothing', () => {
    expect(
      afterControl('first=20', (search) =>
        withTablePageSize(search, DEFAULT_TABLE_PAGE_SIZE),
      ),
    ).toEqual({})
  })

  it('drops the cursor when the page size changes, and keeps the sort', () => {
    expect(
      afterControl('orderBy=name&order=asc&cursor=eyJpZCI6MX0', (search) =>
        withTablePageSize(search, 20),
      ),
    ).toEqual({ first: 20, order: 'asc', orderBy: 'name' })
  })

  it('searches, and stops searching, without losing the sort', () => {
    expect(
      afterControl('orderBy=name&order=asc', (search) =>
        withTableSearch(search, 'logo'),
      ),
    ).toEqual({ order: 'asc', orderBy: 'name', search: 'logo' })

    expect(
      afterControl('orderBy=name&order=asc&search=logo', (search) =>
        withTableSearch(search, ''),
      ),
    ).toEqual({ order: 'asc', orderBy: 'name' })
  })

  it('survives a full round trip unchanged when nothing was clicked', () => {
    for (const query of [
      '',
      'first=20',
      'orderBy=name&order=desc',
      'search=logo&cursor=eyJpZCI6MX0',
    ]) {
      const search = searchFor(query)

      expect(myFilesSearchFrom(myFilesSearchParams(search).toString())).toEqual(
        search,
      )
    }
  })
})

describe('a delete makes the visitor’s files stale, and only those', () => {
  const seed = () => {
    const queryClient = new QueryClient()
    const firstPage = myFilesQuery({
      params: myFilesRouteParams(searchFor('')),
      userId: USER,
    })
    const sorted = myFilesQuery({
      params: myFilesRouteParams(searchFor('orderBy=name&order=asc')),
      userId: USER,
    })
    // A partition left behind by a visitor who signed out on this browser. It is
    // unreachable - every authenticated route builds its key from the current
    // session - and a delete must not reach it either.
    const otherVisitor = myFilesQuery({
      params: myFilesRouteParams(searchFor('')),
      userId: OTHER_USER,
    })
    const session = ['vitnode', 'session'] as const

    queryClient.setQueryData(firstPage.queryKey, { edges: [], pageInfo: {} })
    queryClient.setQueryData(sorted.queryKey, { edges: [], pageInfo: {} })
    queryClient.setQueryData(otherVisitor.queryKey, { edges: [], pageInfo: {} })
    queryClient.setQueryData(session, { user: { id: USER } })

    return { firstPage, otherVisitor, queryClient, session, sorted }
  }

  const isStale = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
    queryClient.getQueryState(queryKey)?.isInvalidated === true

  it('marks every page, sort and search of the list, not just the one on screen', () => {
    // A delete changes which rows exist, so the pages the visitor reaches by
    // pressing a button - and reads from the cache - are wrong too.
    const { firstPage, queryClient, sorted } = seed()

    void invalidateMyFiles(queryClient, USER)

    expect(isStale(queryClient, firstPage.queryKey)).toBe(true)
    expect(isStale(queryClient, sorted.queryKey)).toBe(true)
  })

  it('leaves a previous visitor’s partition untouched', () => {
    // Prefix matching is the whole of it: `['files','user',10]` is not a prefix
    // of `['files','user',20,...]`, so one visitor's delete cannot refetch a
    // list on behalf of somebody who has signed out.
    const { otherVisitor, queryClient } = seed()

    void invalidateMyFiles(queryClient, USER)

    expect(isStale(queryClient, otherVisitor.queryKey)).toBe(false)
  })

  it('leaves everything else in the cache alone', () => {
    // Emphatically not `invalidateQueries()` with no key: the session and the
    // messages have not changed because a file was deleted.
    const { queryClient, session } = seed()

    void invalidateMyFiles(queryClient, USER)

    expect(isStale(queryClient, session)).toBe(false)
  })

  it('keeps the rows on screen while the fresh ones are fetched', () => {
    // Invalidating rather than removing, so the table is not blanked under a
    // dialog that is still open.
    const { firstPage, queryClient } = seed()

    void invalidateMyFiles(queryClient, USER)

    expect(queryClient.getQueryData(firstPage.queryKey)).toBeDefined()
  })
})

describe('`/files` is this app’s route now', () => {
  const router = getRouter()

  it('is owned, so MigrationLink navigates to it client-side', () => {
    // There is no list of migrated routes anywhere in that decision - the route
    // tree is the list. Adding the route file is the whole of the handover.
    expect(isTanStackOwnedPath(router, '/files')).toBe(true)
  })

  it('is owned under the locale prefix too, because that is the same route', () => {
    expect(isTanStackOwnedPath(router, '/pl/files')).toBe(true)
  })

  it('is owned with the table’s own parameters on it', () => {
    expect(isTanStackOwnedPath(router, '/files?orderBy=name&order=asc')).toBe(
      true,
    )
  })

  it('does not drag the routes underneath it away from Next.js', () => {
    // `matchRoutes` answers with the deepest *branch* it can resolve, so owning
    // `/files` used to make anything below it look owned as well.
    expect(isTanStackOwnedPath(router, '/files/12')).toBe(false)
  })

  it('sits under the main shell and the pathless guard, not at the top of the tree', () => {
    const matched = router.matchRoutes('/files', undefined) as {
      routeId: string
    }[]

    expect(matched.map((match) => match.routeId)).toEqual([
      '__root__',
      '/_main',
      '/_main/_authenticated',
      '/_main/_authenticated/files',
    ])
  })
})
