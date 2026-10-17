import type { QueryClient } from "@tanstack/react-query";

import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { SessionApi } from "./session-api";
import type { AuthState } from "./state";

import { authStateFromSession, SESSION_QUERY_KEY } from "./state";
import { authTransport } from "./transport";

const SESSION_STALE_TIME = 30_000;

/**
 * The current visitor's session as a TanStack Query: `{ user }`, the signed-in
 * user (with `isAdmin`, `isModerator` and notification state) or `null` for a
 * guest. Fresh for 30 seconds, never
 * retried. Use it to warm the session in a loader; read it in components with
 * {@link useSessionQuery}.
 */
export const sessionQueryOptions = () =>
  queryOptions({
    queryFn: async () => await authTransport().readSession(),
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    staleTime: SESSION_STALE_TIME,
  });

/** The session query's data and status, as {@link useSessionQuery} returns them. */
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

/**
 * The current visitor's session in a component - `data.user` is `null` for a
 * guest. During hydration it returns what the server rendered with, so markup
 * that depends on the session never mismatches; afterwards it follows the live
 * query.
 *
 * @example
 * ```tsx
 * import { useSessionQuery } from "@vitnode/core/tanstack/auth";
 *
 * const { data } = useSessionQuery();
 * if (!data?.user) return <SignInButton />;
 * ```
 */
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

/**
 * Loads the session (from cache when fresh) and narrows it to an
 * `AuthState` - for a loader or `beforeLoad` that must know whether the
 * visitor is signed in or an admin.
 */
export const ensureAuthState = async (
  queryClient: QueryClient,
): Promise<AuthState> =>
  authStateFromSession(await queryClient.query(sessionQueryOptions()));

/** Replaces the cached session, e.g. with the one a sign-in answered. */
export const setSessionData = (
  queryClient: QueryClient,
  session: SessionApi,
): void => {
  queryClient.setQueryData(sessionQueryOptions().queryKey, session);
};

/** Marks the cached session stale and refetches it where it is observed - after anything that changes who is signed in. */
export const invalidateSession = async (
  queryClient: QueryClient,
): Promise<void> =>
  await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });

/** Warms the session query, ignoring failures. */
export const prefetchSession = async (
  queryClient: QueryClient,
): Promise<void> => {
  await queryClient.query(sessionQueryOptions()).catch(() => undefined);
};
