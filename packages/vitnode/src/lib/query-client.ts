import type { Query, QueryClientConfig } from "@tanstack/react-query";

import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";

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
