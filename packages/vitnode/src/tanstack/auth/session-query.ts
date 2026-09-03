import type { QueryClient } from "@tanstack/react-query";

import { queryOptions } from "@tanstack/react-query";

import type { SessionApi } from "./session-api";
import type { AuthState } from "./state";

import { authStateFromSession, SESSION_QUERY_KEY } from "./state";
import { authTransport } from "./transport";

const SESSION_STALE_TIME = 30_000;

export const sessionQueryOptions = () =>
  queryOptions({
    queryFn: async () => await authTransport().readSession(),
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    staleTime: SESSION_STALE_TIME,
  });

export const ensureAuthState = async (
  queryClient: QueryClient,
): Promise<AuthState> =>
  authStateFromSession(await queryClient.fetchQuery(sessionQueryOptions()));

export const setSessionData = (
  queryClient: QueryClient,
  session: SessionApi,
): void => {
  queryClient.setQueryData(sessionQueryOptions().queryKey, session);
};

export const invalidateSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

export const prefetchSession = async (
  queryClient: QueryClient,
): Promise<void> => {
  await queryClient.prefetchQuery(sessionQueryOptions());
};
