import type { Query, QueryClientConfig } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";

/**
 * `meta` for a query whose data a route loader returns as its `loaderData`.
 *
 * The router already ships `loaderData` to the browser with the HTML, so
 * dehydrating the query as well would put the same data in the page twice. The
 * browser starts without the entry, renders from `loaderData`, and the next
 * loader run fills the cache.
 */
export const LOADER_DATA_QUERY_META = { dehydrate: false } as const;

// Every query streams to the browser - pending ones included, as the router's
// SSR integration does by default - except the ones a loader already ships.
const shouldDehydrateQuery = (query: Query): boolean =>
  query.meta?.dehydrate !== false;

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
