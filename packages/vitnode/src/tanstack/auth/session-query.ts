import type { QueryClient } from "@tanstack/react-query";

import { queryOptions, useQuery } from "@tanstack/react-query";

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

export const useSessionQuery = () => useQuery(sessionQueryOptions());

export const ensureAuthState = async (
  queryClient: QueryClient,
): Promise<AuthState> =>
  authStateFromSession(await queryClient.query(sessionQueryOptions()));

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
  await queryClient.query(sessionQueryOptions()).catch(() => undefined);
};

// A navigation only blocks on the session when there is nothing to render the
// header with (SSR, first load) or the entry was invalidated (sign-in/out).
// Otherwise a stale read refreshes in the background instead of holding the
// route behind a round trip every 30s.
export const loadSession = async (queryClient: QueryClient): Promise<void> => {
  const state = queryClient.getQueryState(SESSION_QUERY_KEY);

  if (state?.data === undefined || state.isInvalidated) {
    await prefetchSession(queryClient);

    return;
  }

  void prefetchSession(queryClient);
};
