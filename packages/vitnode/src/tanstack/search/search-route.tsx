import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import type { SearchFeedParams } from "@/views/search/search-feed-query";

import { intlQueryOptions } from "../i18n/query";
import { feedQueryOptions } from "./feed";
import { searchRouteFeedParams } from "./route-search";

/**
 * What `/search` renders strings from.
 *
 * `core.global` is the shell's, `core.search` is everything else - the heading,
 * the placeholder, the sort labels, the type labels, the feed's empty state and
 * its "load more". One list, read by both the loader that fetches them and the
 * provider that mounts them, because they have to be the same set or the
 * provider suspends on a key nobody warmed.
 */
export const SEARCH_NAMESPACES = ["core.global", "core.search"] as const;

/** The narrowest slice of a route's context this loader reads. */
export interface SearchLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadSearchRoute} returns, and therefore what `head` receives. */
export interface SearchRouteData {
  description: string;
  params: SearchFeedParams;
  title: string;
}

/**
 * Everything `/search` needs, fetched in parallel before it renders.
 *
 * `params` is returned rather than rebuilt in the component: the object handed
 * to the controls as their starting point is *literally* the one whose cache
 * entry was warmed, so the two cannot drift apart through a difference in how
 * each derived it.
 *
 * `search` is the term from the URL, which the host passes through `loaderDeps`
 * so the loader re-runs when it changes and only then - without that, following
 * a link from `?search=hono` to `?search=drizzle` would render the first result
 * set and fetch the second from the browser.
 *
 * See {@link loadDiscoverRoute} for why the messages are translated here rather
 * than in `head`, and why the message type is cast.
 */
export const loadSearchRoute = async ({
  locale,
  queryClient,
  search,
}: SearchLoaderContext & { search?: string }): Promise<SearchRouteData> => {
  const params = searchRouteFeedParams({ search });

  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: SEARCH_NAMESPACES }),
    ),
    queryClient.ensureInfiniteQueryData(feedQueryOptions({ locale, params })),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { search: { desc: string; title: string } };
    },
    namespace: "core.search",
  });

  return { description: t("desc"), params, title: t("title") };
};

/**
 * `/search`, as everything below a route file's `component`.
 *
 * The term in the URL is the controls' starting point, so a *change* to it has
 * to become a new starting point - and the controls hold their term in state,
 * which React preserves across a re-render. Keyed on the term, the loader
 * re-running for `?search=drizzle` remounts them, and they read the entry that
 * loader just warmed instead of showing the previous search over
 * freshly-fetched-and-ignored results.
 *
 * `feedQuery` is a factory rather than a finished options object because the
 * visitor changes the request: every keystroke, filter and sort is a different
 * query, built from the same factory the loader used, so all of them share one
 * contract and one cache.
 */
