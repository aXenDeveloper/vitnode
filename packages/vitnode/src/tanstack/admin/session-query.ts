import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { AdminAccessState } from "./session-api";

import {
  ADMIN_SESSION_QUERY_KEY,
  AdminSessionUnavailableError,
  isAdminAccess,
} from "./state";
import { adminTransport } from "./transport";

const ADMIN_SESSION_STALE_TIME = 0;

const ADMIN_SESSION_PRELOAD_STALE_TIME = 30_000;

const ADMIN_SESSION_GC_TIME = 60_000;

export const adminSessionQueryOptions = () =>
  queryOptions({
    gcTime: ADMIN_SESSION_GC_TIME,
    queryFn: async (): Promise<AdminAccessState> => {
      const read = await adminTransport().readAdminSession();

      if (isAdminAccess(read)) return read;

      throw new AdminSessionUnavailableError(read);
    },
    queryKey: ADMIN_SESSION_QUERY_KEY,
    retry: false,
    staleTime: ADMIN_SESSION_STALE_TIME,
  });

export const ensureAdminAccess = async (
  queryClient: QueryClient,
): Promise<AdminAccessState> =>
  await queryClient.fetchQuery(adminSessionQueryOptions());

export const preloadAdminAccess = async (
  queryClient: QueryClient,
): Promise<AdminAccessState> =>
  await queryClient.fetchQuery({
    ...adminSessionQueryOptions(),
    staleTime: ADMIN_SESSION_PRELOAD_STALE_TIME,
  });

export const prefetchAdminAccess = async (
  queryClient: QueryClient,
): Promise<AdminAccessState | undefined> => {
  await queryClient.prefetchQuery(adminSessionQueryOptions());

  return queryClient.getQueryData(adminSessionQueryOptions().queryKey);
};

export const invalidateAdminSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: ADMIN_SESSION_QUERY_KEY });
