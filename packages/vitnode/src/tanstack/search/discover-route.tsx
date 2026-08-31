import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { discoverFeedQueryOptions } from "./discover";

/**
 * What Discover renders strings from.
 *
 * `core.global` is the shell's, `core.search` is the feed's - its empty state,
 * its "load more", the label on every result type. One list, read by both the
 * loader that fetches them and the provider that mounts them, because they have
 * to be the same set or the provider suspends on a key nobody warmed.
 */
export const DISCOVER_NAMESPACES = ["core.global", "core.search"] as const;

/** The narrowest slice of a route's context this loader reads. */
export interface DiscoverLoaderContext {
  locale: string;
  queryClient: QueryClient;
}

/** What {@link loadDiscoverRoute} returns, and therefore what `head` receives. */
export interface DiscoverRouteData {
  description: string;
  title: string;
}

/**
 * Both things Discover needs, fetched in parallel before it renders.
 *
 * `locale` is the route context's, resolved from the public URL - so
 * `/pl/discover` fetches Polish messages and a Polish feed, and the first byte
 * of HTML is already in that language.
 *
 * Neither call is repeated by the component: the messages are read back by
 * `RouteMessages` through the identical `intlQueryOptions`, and the feed by
 * `SearchFeedContent` through the key `discoverFeedQueryOptions` warms. A
 * mismatch on either would show up as a render that starts empty and fills in a
 * round trip later, which is the thing SSR is for.
 *
 * The strings the metadata needs are returned rather than looked up again, so
 * the tab title and the `<h1>` are the same string by construction - which is
 * what the Next.js route gets from calling `getTranslations` once per request.
 *
 * The cast is what makes `createTranslator` usable: its key type is derived from
 * the *inferred* type of `messages`, and a bare index signature collapses
 * `MessageKeys` to `never`. Naming the two keys read here is both the smallest
 * fix and a true statement - rename either in `locales/en.json` and this stops
 * compiling rather than rendering a raw key into a `<title>`.
 */
export const loadDiscoverRoute = async ({
  locale,
  queryClient,
}: DiscoverLoaderContext): Promise<DiscoverRouteData> => {
  const [intl] = await Promise.all([
    queryClient.ensureQueryData(
      intlQueryOptions({ locale, namespaces: DISCOVER_NAMESPACES }),
    ),
    queryClient.ensureInfiniteQueryData({
      ...discoverFeedQueryOptions({ locale }),
      revalidateIfStale: true,
    }),
  ]);

  const t = createTranslator({
    locale,
    messages: intl.messages as {
      core: { search: { discoverDesc: string; discoverTitle: string } };
    },
    namespace: "core.search",
  });

  return { description: t("discoverDesc"), title: t("discoverTitle") };
};

/**
 * Discover, as everything below a route file's `component`.
 *
 * `LinkComponent` is the one thing a package cannot decide: a search result
 * points wherever the indexed content lives, and the shared feed is host-neutral
 * by design. External and unsafe URLs never reach it - `SearchFeedContent`
 * classifies those and renders them itself.
 *
 * The query options are built here from the same factory the loader used, so
 * this is a cache read rather than a fetch: no `initialData` and no Suspense
 * boundary, both of which would be admissions that the data is not here yet.
 * `fetchNextPage` then continues from the loader's cursor through the loader's
 * own request and status checking.
 */
