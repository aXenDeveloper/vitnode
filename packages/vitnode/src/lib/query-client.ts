import type { Query, QueryClientConfig } from "@tanstack/react-query";

import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

/**
 * Query `meta` that keeps a query out of the SSR dehydrated cache. Use it on a
 * query whose data a route's loader already returns - the router sends that
 * data with the HTML, so dehydrating the query too would send it twice. Leave
 * it off for queries a page reads with `useSuspenseQuery`.
 */
export const LOADER_DATA_QUERY_META = { dehydrate: false } as const;

const shouldDehydrateQuery = (query: Query): boolean =>
  query.meta?.dehydrate !== false &&
  (defaultShouldDehydrateQuery(query) || query.state.status === "pending");

export const createVitNodeQueryClient = (
  config?: QueryClientConfig,
): QueryClient =>
  new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      dehydrate: {
        shouldDehydrateQuery,
        ...config?.defaultOptions?.dehydrate,
      },
      queries: {
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: false,
        ...config?.defaultOptions?.queries,
      },
    },
  });
