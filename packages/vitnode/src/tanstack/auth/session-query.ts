import type { QueryClient } from "@tanstack/react-query";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

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

export interface SessionQueryView {
  data: SessionApi | undefined;
  isError: boolean;
  isPending: boolean;
}

const renderedSessions = new WeakMap<QueryClient, SessionQueryView>();

const renderedSessionOf = (queryClient: QueryClient): SessionQueryView => {
  const rendered = renderedSessions.get(queryClient);
  if (rendered) return rendered;

  const state = queryClient.getQueryState(sessionQueryOptions().queryKey);
  const view = {
    data: state?.data,
    isError: state?.status === "error",
    isPending: !state || state.status === "pending",
  };
  renderedSessions.set(queryClient, view);

  return view;
};

const subscribeToNothing = () => () => undefined;

export const useSessionQuery = (): SessionQueryView => {
  const queryClient = useQueryClient();
  const { data, isError, isPending } = useQuery(sessionQueryOptions());
  const rendered = React.useSyncExternalStore(
    subscribeToNothing,
    () => null,
    () => renderedSessionOf(queryClient),
  );

  return rendered ?? { data, isError, isPending };
};

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
