import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import React from "react";

import type {
  DebugLogsPageFetcher,
  DebugLogsParams,
  DebugQueueFetcher,
} from "@/views/admin/views/core/debug/debug-query";

import {
  debugLogsQueryOptions,
  debugQueueQueryOptions,
  fetchDebugLogsPageInBrowser,
  fetchDebugQueueInBrowser,
} from "@/views/admin/views/core/debug/debug-query";

import { fetchDebugLogsPageOnServer, fetchDebugQueueOnServer } from "./server";

/**
 * The debug panel for a TanStack Start host: two query definitions, and the one
 * action that has no endpoint at all.
 *
 * The transport boundary is the same one every AdminCP read uses - both branches
 * call Hono directly, and the admin cookie travels on both. See
 * `tanstack/admin/cron/query.ts` for the full argument, including why each
 * chained call has to be written out rather than hidden behind a helper.
 */
const fetchDebugLogsPage: DebugLogsPageFetcher = createIsomorphicFn()
  .server(fetchDebugLogsPageOnServer)
  .client(fetchDebugLogsPageInBrowser);

const fetchDebugQueue: DebugQueueFetcher = createIsomorphicFn()
  .server(fetchDebugQueueOnServer)
  .client(fetchDebugQueueInBrowser);

/**
 * The system log, as the one query definition every caller shares.
 *
 * `params` must be the *normalised* ones, because the cache key is built from
 * them.
 */
export const debugLogsQuery = ({ params }: { params: DebugLogsParams }) =>
  debugLogsQueryOptions({ fetchPage: fetchDebugLogsPage, params });

/** The queue snapshot, as the one query definition every caller shares. */
export const debugQueueQuery = () =>
  debugQueueQueryOptions({ fetchSnapshot: fetchDebugQueue });

/**
 * "Clear the cache", as a TanStack Start application can mean it.
 *
 * The Next.js server action is `revalidatePath("/", "layout")` - it has no API
 * call in it, because what it clears is the *framework's* cache rather than
 * anything on the server. The equivalent here is the pair of caches this
 * application actually has:
 *
 *     queryClient.invalidateQueries()  every cached read, marked stale
 *     router.invalidate()              every matched route's loader, re-run
 *
 * **Invalidate, not clear.** `queryClient.clear()` deletes entries outright,
 * including `["vitnode","admin-session"]` - which the permission provider reads
 * with `useSuspenseQuery`, so clearing it suspends the whole AdminCP shell on
 * the frame after the button is pressed. Invalidation keeps every value on
 * screen while it is refetched, which is both correct and what `revalidatePath`
 * does.
 *
 * It is scoped to no key on purpose, and this is the one place in the AdminCP
 * where that is right: the button's entire meaning is "everything you are
 * holding may be wrong". Every *other* mutation invalidates its own family - see
 * `invalidateCron`, `invalidateAdminFiles`, `invalidateSearchIndex`.
 *
 * Rejects rather than returning an error, matching the server action it stands
 * in for: `ClearCacheAction` catches and shows the same toast either way.
 */
export const clearAdminCache = async (
  queryClient: QueryClient,
  router: AnyRouter,
): Promise<void> => {
  await queryClient.invalidateQueries();
  await router.invalidate();
};

/**
 * `clearAdminCache`, bound to the mounted router and its cache.
 *
 * Memoised so the confirm dialog's submit handler keeps one identity across the
 * re-renders an invalidation causes.
 */
export const useClearAdminCache = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return React.useMemo(
    () => async () => {
      await clearAdminCache(queryClient, router);
    },
    [queryClient, router],
  );
};
