import { createRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import type { AdminScreenContext } from "../../admin";
import type { ContentListRouteSearch } from "../../admin/content";
import type { CoreAdminRouteContext, CoreRouteFactory } from "../types";

import {
  ContentAdminBreadcrumbContent,
  ContentAdminScreenContent,
  contentRouteSegments,
  loadContentAdminRoute,
  loadContentFormScreen,
} from "../../admin/content";
import { routeContext, routeSearch } from "../types";

/**
 * `/admin/content/*` - every screen the Content Engine generates.
 *
 * The slug resolution, the permission, the namespaces, the labels, the list
 * query, the table, the row actions, the breadcrumb and the screen shell are
 * `../content`. The two things injected are the ones a package cannot know:
 * which plugins this installation configured (`contentRegistry`) and what the
 * site is called (`pageHead`).
 *
 * ## One splat, three screens, and no file per content type
 *
 * `$` is the whole path below `/admin/content`, handed to a pure resolver. That
 * is what keeps `admin.path` working: a content type may answer at a name its id
 * does not spell (`blog.post` at `blog/articles`), and no route tree can be
 * generated from ids without breaking it. It is also why `blog/post/create`
 * still reaches a content type registered at exactly that path rather than the
 * create page of `blog/post` - the resolver tries the exact match first.
 *
 * ## Why this could never have been a plugin route
 *
 * A splat is not representable in the plugin manifest's path grammar, which
 * parses static and parameter segments and rejects a catch-all in as many words.
 * It does not need to be: the manifest's grammar exists so that two *untrusted*
 * plugins cannot claim one URL without the build noticing, and core is not one
 * of them. A code-based route gets the router's own path syntax, splat included.
 *
 * ## Why `validateSearch` only carries the search through
 *
 * A content list's URL contract is a function of *its own content type* - which
 * columns it sorts by, which filters it accepts, what page size its API defaults
 * to - and `validateSearch` is handed the query string alone, never the path
 * params, so it cannot know which content type this URL is for. Normalising is
 * therefore the loader's job, where the splat has just resolved. A control that
 * changes a page, a sort or a search writes back through the same contract, so
 * the address bar stays canonical - only a hand-typed `?orderBy=nonsense`
 * survives in the URL, and it renders the default table rather than an error.
 *
 * ## The splat is narrow on purpose
 *
 * It claims the Content Engine's namespace and nothing adjacent. A splat one
 * level up - `/admin/$` - would swallow every AdminCP URL this router does not
 * serve, turning a working sidebar link into a not-found.
 * `apps/web/src/tests/admin-routes.test.ts` pins both halves: that this route
 * owns `/admin/content/*`, and that it owns nothing else.
 */
export const contentAdminRoute: CoreRouteFactory<CoreAdminRouteContext> = ({
  contentRegistry,
  pageHead,
  parentRoute,
}) => {
  const route = createRoute({
    getParentRoute: () => parentRoute,
    validateSearch: (search: Record<string, unknown>): ContentListRouteSearch =>
      search as ContentListRouteSearch,
    /** The whole search: which page, sort, search term and filters to load. */
    loaderDeps: ({ search }) => ({
      search: routeSearch<ContentListRouteSearch>(search),
    }),
    /**
     * Two loads, in this order, because the second depends on the first.
     *
     * `loadContentAdminRoute` resolves which content type and which of the three
     * screens this URL is, checks `can_view`, warms the strings and - for a list
     * - the page of rows. `loadContentFormScreen` then adds what only a *form*
     * URL needs: `can_create` or `can_edit`, the record being edited and its
     * translations. It returns nothing at all for a list, so a list navigation
     * pays for one call and no requests.
     */
    // `head` after `loader`, always.
    loader: async ({ context, deps, params }) => {
      const resolved = await loadContentAdminRoute({
        ...routeContext<AdminScreenContext>(context),
        registry: contentRegistry,
        search: deps.search,
        segments: contentRouteSegments((params as { _splat?: string })._splat),
      });

      return {
        ...resolved,
        ...(await loadContentFormScreen({
          ...routeContext<AdminScreenContext>(context),
          registry: contentRegistry,
          route: resolved,
        })),
      };
    },
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/content/$",
  });

  route.update({
    /**
     * The trail, read from this route's own loader data.
     *
     * The shell renders it above the route's component, so it cannot be handed
     * props from there - `route.useLoaderData()` reaches the same match instead.
     * It is declared as an element on `staticData` and rendered inside the
     * router, which is what makes the hook legal.
     */
    staticData: {
      breadcrumb: <ContentAdminBreadcrumb />,
    },
    component: function ContentAdminRoute() {
      const navigate = route.useNavigate();

      return (
        <ContentAdminScreenContent
          {...route.useLoaderData()}
          navigate={useCallback(
            async ({
              resetScroll,
              search,
            }: {
              resetScroll: boolean;
              search: ContentListRouteSearch;
            }) => {
              await navigate({ resetScroll, search });
            },
            [navigate],
          )}
          registry={contentRegistry}
          search={route.useSearch()}
        />
      );
    },
  });

  function ContentAdminBreadcrumb() {
    return <ContentAdminBreadcrumbContent {...route.useLoaderData()} />;
  }

  return route;
};
