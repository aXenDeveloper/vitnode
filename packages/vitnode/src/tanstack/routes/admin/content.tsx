import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { useCallback } from "react";

import type { ContentListRouteSearch } from "../../admin/content/route-search";
import type { AdminScreenContext } from "../../admin/screen";
import type { CoreAdminRouteContext, CoreRouteFactory } from "../types";

import { ContentAdminBreadcrumbContent } from "../../admin/content/breadcrumb";
import { breadcrumbGroup } from "../../breadcrumb/model";
import { TablePendingSkeleton } from "../../pending";
import { routeContext, routeSearch } from "../types";

/**
 * `/admin/content/*` - every screen the Content Engine generates.
 *
 * The slug resolution, the permission, the namespaces, the labels, the list
 * query, the table, the row actions, the breadcrumb and the screen shell are
 * `../content`. The two things injected are the ones a package cannot know:
 * which plugins this installation configured (`loadContentRegistry`) and what
 * the site is called (`pageHead`).
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
  loadContentRegistry,
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
     *
     * ## Why the Content Engine is imported *inside* the loader
     *
     * Because a `loader` is a function and a route file is a module. The route
     * itself - its path, its search contract, its crumb - is evaluated in the
     * client entry, on every page of the application; the body of this function
     * runs only when somebody navigates to `/admin/content/*`. Reaching
     * `@vitnode/core/content` at module scope put the whole engine on the front
     * page's critical path: the resolver, the field specs, `zod`, and through
     * the registry every configured plugin's admin form components.
     *
     * The three imports and the registry are awaited together rather than in
     * sequence, so the chunks are fetched in parallel and the loader pays one
     * round trip rather than four.
     *
     * Nothing about *when* the permission check happens changes.
     * `loadContentAdminRoute` still calls `requireAdminPermission` inside this
     * loader, which the router awaits before it renders the match - and the
     * AdminCP session guard on the shell above is untouched and still entirely
     * eager. What is deferred is the code, not the check.
     */
    // `head` after `loader`, always.
    loader: async ({ context, deps, params }) => {
      const [
        { contentRouteSegments, loadContentAdminRoute },
        { loadContentFormScreen },
        registry,
      ] = await Promise.all([
        import("../../admin/content/route"),
        import("../../admin/content/form/route"),
        loadContentRegistry(),
      ]);

      const resolved = await loadContentAdminRoute({
        ...routeContext<AdminScreenContext>(context),
        registry,
        search: deps.search,
        segments: contentRouteSegments((params as { _splat?: string })._splat),
      });

      return {
        ...resolved,
        ...(await loadContentFormScreen({
          ...routeContext<AdminScreenContext>(context),
          registry,
          route: resolved,
        })),
      };
    },
    head: ({ loaderData }) => pageHead({ ...loaderData }),
    path: "/admin/content/$",
    pendingComponent: TablePendingSkeleton,
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
      breadcrumb: breadcrumbGroup(ContentAdminBreadcrumb),
    },
    component: lazyRouteComponent(async () => {
      const [{ ContentAdminScreenContent }, registry] = await Promise.all([
        import("../../admin/content/screen"),
        loadContentRegistry(),
      ]);

      return {
        default: function ContentAdminRoute() {
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
              registry={registry}
              search={route.useSearch()}
            />
          );
        },
      };
    }),
  });

  function ContentAdminBreadcrumb() {
    return <ContentAdminBreadcrumbContent {...route.useLoaderData()} />;
  }

  return route;
};
