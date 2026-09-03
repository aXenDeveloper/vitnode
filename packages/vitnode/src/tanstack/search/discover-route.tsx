import type { QueryClient } from "@tanstack/react-query";

import { createTranslator } from "use-intl";

import { intlQueryOptions } from "../i18n/query";
import { discoverFeedQueryOptions } from "./discover";

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
