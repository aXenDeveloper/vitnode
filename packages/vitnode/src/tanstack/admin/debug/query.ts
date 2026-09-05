import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";

import type {
  DebugLogsPageFetcher,
  DebugLogsParams,
  DebugQueueFetcher,
} from "@/views/admin/views/core/debug/debug-query";

import { fetcher } from "@/tanstack/fetcher";
import {
  debugLogsPageFetcher,
  debugLogsQueryOptions,
  debugQueueFetcher,
  debugQueueQueryOptions,
} from "@/views/admin/views/core/debug/debug-query";

const fetchDebugLogsPage: DebugLogsPageFetcher = debugLogsPageFetcher(fetcher);

const fetchDebugQueue: DebugQueueFetcher = debugQueueFetcher(fetcher);

export const debugLogsQuery = ({ params }: { params: DebugLogsParams }) =>
  debugLogsQueryOptions({ fetchPage: fetchDebugLogsPage, params });

/** The queue snapshot, as the one query definition every caller shares. */
export const debugQueueQuery = () =>
  debugQueueQueryOptions({ fetchSnapshot: fetchDebugQueue });

export const clearAdminCache = async (
  queryClient: QueryClient,
  router: AnyRouter,
): Promise<void> => {
  await queryClient.invalidateQueries();
  await router.invalidate();
};

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
