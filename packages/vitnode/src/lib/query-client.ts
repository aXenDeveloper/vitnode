import type { QueryClientConfig } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";

export const createVitNodeQueryClient = (
  config?: QueryClientConfig,
): QueryClient =>
  new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: {
        refetchOnMount: false,
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: false,
        ...config?.defaultOptions?.queries,
      },
    },
  });
