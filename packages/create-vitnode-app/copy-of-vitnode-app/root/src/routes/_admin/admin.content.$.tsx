import type { ContentListRouteSearch } from '@vitnode/core/tanstack/admin/content'

import { createFileRoute } from '@tanstack/react-router'
import {
  ContentAdminBreadcrumbContent,
  ContentAdminScreenContent,
  contentRouteSegments,
  loadContentAdminRoute,
  loadContentFormScreen,
} from '@vitnode/core/tanstack/admin/content'

import { contentRegistry } from '#/lib/content-registry'
import { pageHead } from '#/lib/page-head'

/**
 * `/admin/content/*` - every screen the Content Engine generates.
 *
 * Topology only. The slug resolution, the permission, the namespaces, the
 * labels, the list query, the table, the row actions, the breadcrumb and the
 * screen shell are `@vitnode/core/tanstack/admin/content`; the two things this
 * file supplies are the ones a package cannot know - which plugins this
 * installation configured, and how a path becomes a navigation.
 *
 * ## One splat, three screens, and no file per content type
 *
 * `$` is the whole path below `/admin/content`, handed to the same pure resolver
 * the Next.js catch-all uses. That is what keeps `admin.path` working: a content
 * type may answer at a name its id does not spell (`blog.post` at
 * `blog/articles`), and no route tree can be generated from ids without breaking
 * it. It is also why `blog/post/create` still reaches a content type registered
 * at exactly that path rather than the create page of `blog/post` - the resolver
 * tries the exact match first, and always has.
 *
 * ## Why `validateSearch` only carries the search through
 *
 * A content list's URL contract is a function of *its own content type* - which
 * columns it sorts by, which filters it accepts, what page size its API defaults
 * to - and `validateSearch` is handed the query string alone, never the path
 * params, so it cannot know which content type this URL is for. Normalising is
 * therefore the loader's job, where the splat has just resolved: it runs
 * `contentListRouteParams` against the resolved definition and returns the
 * request it produced. A control that changes a page, a sort or a search writes
 * back through the same contract, so the address bar stays canonical - only a
 * hand-typed `?orderBy=nonsense` survives in the URL, and it renders the default
 * table rather than an error.
 *
 * ## The splat is narrow on purpose
 *
 * `/_admin/admin/content/$` claims the Content Engine's namespace and nothing
 * adjacent. A splat one level up - `_admin/$` or `/_admin/admin/$` - would
 * swallow every AdminCP URL this router does not serve, turning a working
 * Next.js screen into a TanStack not-found reached from a working sidebar link.
 * `src/tests/admin-routes.test.ts` pins both halves: that this route owns
 * `/admin/content/*`, and that it owns nothing else.
 *
 * ## The splat is the only claim on this namespace
 *
 * Nothing else declares `/admin/content/*`, and nothing anywhere lists which
 * content screens exist: the route tree is the table, and a content type
 * declared by a plugin becomes a reachable URL through this one route.
 */
export const Route = createFileRoute('/_admin/admin/content/$')({
  validateSearch: (search: Record<string, unknown>): ContentListRouteSearch =>
    search as ContentListRouteSearch,
  /** The whole search: which page, sort, search term and filters to load. */
  loaderDeps: ({ search }) => ({ search }),
  /**
   * Two loads, in this order, because the second depends on the first.
   *
   * `loadContentAdminRoute` resolves which content type and which of the three
   * screens this URL is, checks `can_view`, warms the strings and - for a list -
   * the page of rows. `loadContentFormScreen` then adds what only a *form* URL
   * needs: `can_create` or `can_edit`, the record being edited and its
   * translations. It returns nothing at all for a list, so a list navigation
   * pays for one call and no requests.
   */
  // `head` after `loader`, always - see the note in `_main/discover.tsx`.
  loader: async ({ context, deps, params }) => {
    const route = await loadContentAdminRoute({
      ...context,
      registry: contentRegistry,
      search: deps.search,
      segments: contentRouteSegments(params._splat),
    })

    return {
      ...route,
      ...(await loadContentFormScreen({
        ...context,
        registry: contentRegistry,
        route,
      })),
    }
  },
  head: ({ loaderData }) => pageHead({ ...loaderData }),
  component: ContentAdminRoute,
  staticData: {
    breadcrumb: <ContentAdminBreadcrumb />,
  },
})

/**
 * The trail, read from this route's own loader data.
 *
 * The shell renders it above the route's component, so it cannot be handed props
 * from there - `Route.useLoaderData()` reaches the same match instead. It is
 * declared as an element on `staticData` and rendered inside the router, which
 * is what makes the hook legal.
 */
function ContentAdminBreadcrumb() {
  return <ContentAdminBreadcrumbContent {...Route.useLoaderData()} />
}

function ContentAdminRoute() {
  return (
    <ContentAdminScreenContent
      {...Route.useLoaderData()}
      navigate={Route.useNavigate()}
      registry={contentRegistry}
      search={Route.useSearch()}
    />
  )
}
