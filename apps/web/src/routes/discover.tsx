import type { SearchFeedLinkProps } from '@vitnode/core/views/search/search-feed-content'

import { createFileRoute, Link } from '@tanstack/react-router'
import { HeaderContent } from '@vitnode/core/components/ui/header-content'
import { formatPageTitle } from '@vitnode/core/lib/metadata'
import { SearchFeedContent } from '@vitnode/core/views/search/search-feed-content'
import { createTranslator } from 'use-intl'

import { RouteMessages } from '#/components/route-messages'
import { useLocale } from '#/lib/i18n/client'
import { intlQueryOptions } from '#/lib/i18n/query'
import { discoverFeedQueryOptions } from '#/lib/search/discover-feed'
import { DISCOVER_FEED_PARAMS } from '#/lib/search/discover-request'
import { vitNodeShellConfig } from '#/vitnode.shell.config'

/**
 * Discover, the first VitNode route to render outside Next.js.
 *
 * One route file serving two public URLs. `/discover` and `/pl/discover` match
 * *this* route: the locale is stripped before matching and written back into
 * every link the router builds (`rewrite` in `src/router.tsx`), so nothing here
 * mentions a language and there is no `/pl/discover.tsx` to keep in step. The
 * Next.js route at `packages/vitnode/src/routes/main/discover/page.tsx` is still
 * live and unchanged - this is a parallel slice until the cutover.
 *
 * Everything visible is shared: `HeaderContent` and `SearchFeedContent` are the
 * same modules the Next.js app renders, with the two things a shared component
 * cannot resolve for itself passed in - the locale, and a `Link`.
 */

/**
 * What this page renders strings from.
 *
 * `core.global` is the shell's, `core.search` is the feed's - its empty state,
 * its "load more", the label on every result type. One list, read by both the
 * loader that fetches them and the provider that mounts them, because they have
 * to be the same set or the provider suspends on a key nobody warmed.
 */
const DISCOVER_NAMESPACES = ['core.global', 'core.search'] as const

/**
 * The feed's link, the TanStack way.
 *
 * `to` rather than `href` is the whole adapter: the router owns the locale
 * prefix, so handing it the internal path is what makes `/blog/hello` render as
 * `/pl/blog/hello` while reading `/pl/discover` - and as `/blog/hello` on the
 * unprefixed URL. Writing the prefix here would double it.
 *
 * Declared at module scope rather than inline, so it is the same component type
 * on every render and React reconciles the feed rather than remounting every
 * result. External URLs never reach this: `SearchFeedContent` renders those as a
 * bare `<a>` itself.
 */
const DiscoverFeedLink = ({
  children,
  className,
  href,
}: SearchFeedLinkProps) => (
  <Link className={className} to={href}>
    {children}
  </Link>
)

export const Route = createFileRoute('/discover')({
  component: DiscoverRoute,
  /**
   * Both things this page needs, fetched in parallel before it renders.
   *
   * `context.locale` comes from the root route's `beforeLoad`, which resolved it
   * from the public URL - so `/pl/discover` fetches Polish messages and a Polish
   * feed, and the first byte of HTML is already in that language.
   *
   * Neither call is repeated by the component. The messages are read back by
   * `RouteMessages` through the identical `intlQueryOptions`, and the feed by
   * `SearchFeedContent` through the key `discoverFeedQueryOptions` warms - the
   * key core itself exports for exactly this. A mismatch on either would show up
   * as a render that starts empty and fills in a round trip later, which is the
   * thing SSR is for.
   *
   * The strings the metadata needs are returned rather than looked up again:
   * `createTranslator` is `use-intl`'s framework-free translator, over the
   * messages just fetched.
   */
  loader: async ({ context }) => {
    const [intl] = await Promise.all([
      context.queryClient.ensureQueryData(
        intlQueryOptions({
          locale: context.locale,
          namespaces: DISCOVER_NAMESPACES,
        }),
      ),
      context.queryClient.ensureInfiniteQueryData(
        discoverFeedQueryOptions({ locale: context.locale }),
      ),
    ])

    const t = createTranslator({
      locale: context.locale,
      messages: intl.messages,
      namespace: 'core.search',
    })

    return { description: t('discoverDesc'), title: t('discoverTitle') }
  },
  /**
   * The page's metadata, in the language the request resolved to.
   *
   * **`head` must be written after `loader`.** `loaderData`'s type is inferred
   * from `loader` in the same object literal, and TypeScript reads a literal's
   * members in order - put `head` first and `loaderData` is `never`, while
   * `Route.useLoaderData()` collapses to `undefined`. Neither error names the
   * cause. It costs nothing to get right and half an hour to diagnose.
   *
   * `head` is synchronous here and reads the two strings out of `loaderData`,
   * which is the smallest thing that works and the reason it is worth spelling
   * out: `head` receives no router context, so it cannot resolve a locale, and
   * translating inside it would mean a second lookup that could disagree with
   * the `<h1>`. The loader translates once; the tab title and the heading are
   * then the same string by construction, which is exactly what the Next.js
   * route gets from calling `getTranslations` once per request.
   *
   * `formatPageTitle` applies the same `"<page> - <site>"` rule Next.js applies
   * through `title.template`, so both frameworks produce the same title.
   *
   * This is deliberately route-local. A general answer - metadata declared once
   * and translated for every route - is a pattern this stage does not yet have
   * enough migrated routes to design.
   */
  head: ({ loaderData }) => ({
    meta: [
      // Indexable, and stated rather than assumed: TanStack Start emits no
      // robots directive of its own, and the Next.js route sets
      // `robots: { index: true, follow: true }` explicitly.
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
})

function DiscoverRoute() {
  const locale = useLocale()
  const { description, title } = Route.useLoaderData()

  return (
    <RouteMessages namespaces={DISCOVER_NAMESPACES}>
      <main className="container mx-auto flex max-w-3xl flex-col gap-6 p-4">
        <HeaderContent desc={description} h1={title} />

        {/*
          No `initialData`, and no Suspense boundary either - both would be
          admissions that the data is not here yet. The loader has already put
          this exact query in the cache, so the very first render walks its pages
          and `fetchNextPage` continues from its cursor.
        */}
        <SearchFeedContent
          LinkComponent={DiscoverFeedLink}
          locale={locale}
          params={DISCOVER_FEED_PARAMS}
          variant="timeline"
        />
      </main>
    </RouteMessages>
  )
}
