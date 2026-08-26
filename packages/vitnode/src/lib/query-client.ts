import type { QueryClientConfig } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";

/**
 * VitNode's TanStack Query client, with the defaults every VitNode app runs.
 *
 * `refetchOnWindowFocus` and `refetchOnMount` are both off: VitNode's data comes
 * from its own API behind a cache, and a table that silently refetches every
 * time a tab regains focus is a page that moves under the reader. Mutations
 * invalidate what they changed instead, which is the explicit version of the
 * same thing.
 *
 * One factory rather than one `new QueryClient` per shell, because each app now
 * has two callers - the framework integration and the provider tree - and two
 * clients in one page means a query cached by a route loader is invisible to the
 * component that reads it.
 *
 * Call it *per request* on the server. A module-level client would be shared by
 * every visitor being rendered at once, which is how one person's data ends up
 * in another person's page.
 */
export const createVitNodeQueryClient = (
  config?: QueryClientConfig,
): QueryClient =>
  new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        ...config?.defaultOptions?.queries,
      },
    },
  });
