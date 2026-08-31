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
 * `refetchOnReconnect` is the third of Query's automatic triggers and the one
 * that stays **on**. It was Query's default rather than a decision until now,
 * which is the only thing wrong with it: every other refetch policy in this file
 * says what it is and why, and a trigger nobody wrote down is a trigger nobody
 * can reason about when it fires.
 *
 * It stays on because it is not the same kind of event as the other two. A mount
 * and a focus happen constantly during ordinary use, and refetching on them is
 * what makes a page move under its reader. Losing the network and getting it
 * back happens rarely, and it is the one moment when what is on screen is most
 * likely to be wrong - or, with `retry: false` on almost every read in VitNode,
 * to be an error the visitor has no way to clear but by navigating. Reconnecting
 * is the app's only automatic recovery from an outage, and turning it off would
 * mean a laptop that woke up showed failed screens until somebody clicked
 * something.
 *
 * The cost is known and accepted: most VitNode queries declare no `staleTime`,
 * so they are always stale, so a reconnect refetches every *active* one at once.
 * Active, not cached - an unmounted screen has no observer and is not refetched -
 * which bounds the burst to what a single document is currently rendering.
 *
 * `retry` is the fourth policy and the one that was inherited rather than
 * chosen. Query's own default retries a failed read three times with exponential
 * backoff, and almost every VitNode family already overrides that to `false` -
 * so the default was doing nothing except in the handful of places somebody
 * forgot, which is the worst possible distribution for a policy. Two of those
 * places were privileged AdminCP reads, where retrying is actively wrong: a
 * `403` does not become a `200` because we asked again, and a `429` is answered
 * by sending the same request twice more. One of them - the dashboard layout -
 * carried a comment saying "No `retry`" while inheriting three of them.
 *
 * So `false` here, uniformly, and with no exceptions carved out - which was the
 * second thing worth deciding rather than inheriting. The three families that
 * were quietly retrying are all public and idempotent, so a repeat request could
 * not leak or double-apply anything, and preserving that looked free. It is not:
 * a blanket retry cannot tell a blip from a permanent answer, so it also retries
 * the failures that will never succeed - a misconfigured runtime, a namespace
 * that does not exist - and turns a clear error into three of them behind
 * exponential backoff. `tanstack/i18n/query.test.ts` says so directly: it asserts
 * that an unconfigured runtime fails with the fix in the message, and it fails by
 * *timing out* the moment that query is given retries.
 *
 * The visitor is the retry, and that is already this codebase's stated position
 * on the session: they reload or navigate again, which is a decision they can
 * make and a rate limiter can see coming. Applying it to every read is more
 * coherent than three exceptions preserving a default nobody chose.
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
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        retry: false,
        ...config?.defaultOptions?.queries,
      },
    },
  });
