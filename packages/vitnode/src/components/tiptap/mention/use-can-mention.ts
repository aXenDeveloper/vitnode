import { QueryClientContext } from "@tanstack/react-query";
import React from "react";

import type { SessionApi } from "@/tanstack/auth/session-api";

import { SESSION_QUERY_KEY } from "@/tanstack/auth/state";

const subscribeToNothing = () => () => undefined;

/**
 * Whether the signed-in member's roles may mention, read from the session
 * already in the query cache - never fetched here. `false` without a session
 * or outside a `QueryClientProvider`.
 */
export const useCanMention = (): boolean => {
  const queryClient = React.useContext(QueryClientContext);
  const subscribe = React.useCallback(
    (onChange: () => void) =>
      queryClient
        ? queryClient.getQueryCache().subscribe(onChange)
        : subscribeToNothing(),
    [queryClient],
  );

  return React.useSyncExternalStore(
    subscribe,
    () =>
      queryClient?.getQueryData<SessionApi>(SESSION_QUERY_KEY)?.user
        ?.canMention === true,
    () => false,
  );
};
