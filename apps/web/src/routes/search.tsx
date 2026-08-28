import type { SearchFeedLinkProps } from '@vitnode/core/views/search/search-feed-content'

import { createFileRoute } from '@tanstack/react-router'
import { HeaderContent } from '@vitnode/core/components/ui/header-content'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { SearchControlsContent } from '@vitnode/core/views/search/search-controls-content'
import { createTranslator } from 'use-intl'

import { MigrationLink } from '#/components/migration-link'
import { RouteMessages } from '#/components/route-messages'
import { useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'
import { feedQueryOptions } from '#/lib/search/feed'
import {
  normalizeSearchRouteSearch,
  searchRouteFeedParams,
} from '#/lib/search/search-request'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * Search, rendered outside Next.js.
 *
 * One route file serving two public URLs. `/search` and `/pl/search` match
 * *this* route: the locale is stripped before matching and written back into
 * every link the router builds (`rewrite` in `src/router.tsx`), so nothing here
 * mentions a language and there is no `/pl/search.tsx` to keep in step. The
 * Next.js route at `packages/vitnode/src/routes/main/search/page.tsx` is still
 * live and unchanged - this is a parallel slice until the cutover.
 *
 * Everything visible is shared: `HeaderContent` and `SearchControlsContent` -
 * which is the search box, the type filters, the sort and the feed - are the same
 * modules the Next.js page renders, with the three things a shared component
 * cannot resolve for itself passed in: the locale, a `Link`, and how a feed page
 * is fetched.
 *
 * ## One query contract, one cache entry
 *
 * The feed is `feedQueryOptions` and nothing else, in the loader and in the
 * component:
 *
 *     loader:     ensureInfiniteQueryData(feedQueryOptions({ locale, params }))
 *     component:  <SearchControlsContent feedQuery={params => feedQueryOptions({ locale, params })} />
 *
 * Same key, same page function, same cursor rule - so the loader's page is the
 * page the component renders, and `fetchNextPage` continues from it. There is no
 * `initialData` anywhere on this route: the loader has already put page one in
 * the entry the component reads and the SSR pass dehydrates it, so a second copy
 * of those bytes could only disagree with the first.
 */

/**
 * What this page renders strings from.
 *
 * `core.global` is the shell's, `core.search` is everything else here - the
 * heading, the placeholder, the sort labels, the type labels, the feed's empty
 * state and its "load more". One list, read by both the loader that fetches them
 * and the provider that mounts them, because they have to be the same set or the
 * provider suspends on a key nobody warmed.
 */
const SEARCH_NAMESPACES = ['core.global', 'core.search'] as const

/**
 * The feed's link.
 *
 * `MigrationLink` rather than the router's `Link` directly, because a search
 * result points wherever the indexed content lives and most of VitNode has not
 * moved yet. It asks the route tree whether this app can render the destination:
 * `/discover` is a client-side navigation, `/blog/post-30` is a document load
 * into the Next.js app that still serves it. There is no hand-written list of
 * migrated routes anywhere in that decision - the route tree is the list - so the
 * day `/blog` moves, this file does not change.
 *
 * Declared at module scope rather than inline, so it is the same component type
 * on every render and React reconciles the feed rather than remounting every
 * result on every keystroke. External and unsafe URLs never reach it:
 * `SearchFeedContent` classifies those and renders them itself, which is what
 * keeps a plugin-authored `javascript:` url out of the router.
 */
const SearchFeedLink = ({ children, className, href }: SearchFeedLinkProps) => (
  <MigrationLink className={className} href={href}>
    {children}
  </MigrationLink>
)

export const Route = createFileRoute('/search')({
  component: SearchRoute,
  /**
   * The loader re-runs when the term in the URL changes, and only then.
   *
   * Without this the loader would warm the feed for whatever term the page was
   * first opened with and never again, so following a link from
   * `/search?search=hono` to `/search?search=drizzle` would render the first
   * result set and fetch the second from the browser.
   */
  loaderDeps: ({ search }) => ({ search: search.search }),
  /**
   * Everything this page needs, fetched in parallel before it renders.
   *
   * `context.locale` comes from the root route's `beforeLoad`, which resolved it
   * from the public URL - so `/pl/search` fetches Polish messages and a Polish
   * feed, and the first byte of HTML is already in that language.
   *
   * Neither call is repeated by the component. The messages are read back by
   * `RouteMessages` through the identical `intlQueryOptions`, and the feed by
   * `SearchFeedContent` through the key `feedQueryOptions` warms. A mismatch on
   * either would show up as a render that starts empty and fills in a round trip
   * later, which is the thing SSR is for.
   *
   * `params` is returned rather than rebuilt in the component for exactly that
   * reason: the object handed to the controls as their starting point is
   * *literally* the one whose cache entry was warmed, so the two cannot drift
   * apart through a difference in how each derived it.
   *
   * The strings the metadata needs are returned too rather than looked up again:
   * `createTranslator` is `use-intl`'s framework-free translator, over the
   * messages just fetched.
   */
  loader: async ({ context, deps }) => {
    const params = searchRouteFeedParams({ search: deps.search })

    const [intl] = await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: SEARCH_NAMESPACES,
        }),
      ),
      context.queryClient.ensureInfiniteQueryData(
        feedQueryOptions({ locale: context.locale, params }),
      ),
    ])

    const t = createTranslator({
      locale: context.locale,
      messages: intl.messages,
      namespace: 'core.search',
    })

    return { description: t('desc'), params, title: t('title') }
  },
  /**
   * The page's metadata, in the language the request resolved to.
   *
   * **`head` must be written after `loader`.** `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order - put `head` first and `loaderData` is `never`, while
   * `Route.useLoaderData()` collapses to `undefined`. Neither error names the
   * cause.
   *
   * The loader translates once, so the tab title and the `<h1>` are the same
   * string by construction - which is what the Next.js route gets from calling
   * `getTranslations` once per request. `formatPageTitle` applies the same
   * `"<page> - <site>"` rule Next.js applies through `title.template`.
   */
  head: ({ loaderData }) => ({
    meta: [
      // Indexable, and stated rather than assumed: TanStack Start emits no
      // robots directive of its own, and the Next.js route this replaces sets
      // `robots: { index: true, follow: true }` explicitly. Whether a search
      // page with an arbitrary term *should* be indexed is a question for the
      // SEO pass, not for a migration.
      { content: 'index, follow', name: 'robots' },
      ...(loaderData
        ? [
            {
              title: formatPageTitle(
                vitNodeShellConfig.metadata,
                loaderData.title,
              ),
            },
            { content: loaderData.description, name: 'description' },
          ]
        : []),
    ],
  }),
  validateSearch: normalizeSearchRouteSearch,
})

function SearchRoute() {
  const locale = useLocale()
  const { description, params, title } = Route.useLoaderData()

  return (
    <RouteMessages namespaces={SEARCH_NAMESPACES}>
      <main className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        {/*
          The term in the URL is the controls' starting point, so a *change* to
          it has to become a new starting point - and the controls hold their
          term in state, which React preserves across a re-render. Keyed on the
          term, the loader re-running for `?search=drizzle` remounts them, and
          they read the entry that loader just warmed instead of showing the
          previous search over freshly-fetched-and-ignored results.

          `feedQuery` rather than a finished options object because the visitor
          changes the request: every keystroke, filter and sort is a different
          query, built here from the same factory the loader used, so all of them
          share one contract and one cache.
        */}
        <SearchControlsContent
          defaultParams={params}
          feedQuery={(feedParams) =>
            feedQueryOptions({ locale, params: feedParams })
          }
          key={params.search ?? ''}
          LinkComponent={SearchFeedLink}
          variant="timeline"
        />
      </main>
    </RouteMessages>
  )
}
