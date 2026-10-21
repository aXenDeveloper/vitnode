import type { QueryKey, UseQueryResult } from "@tanstack/react-query";

import { useQueries } from "@tanstack/react-query";
import React from "react";

import { CONTENT_PUBLIC_MAX_PAGE_SIZE } from "@/content/const";

import { useSessionQuery } from "../auth/session-query";

/**
 * What the current visitor may do with one record, as the Content Engine's
 * `GET /{publicApi.path}/permissions` route decides it.
 */
export interface ContentPermissions {
  /** The edit page will open: the owner while allowed, or a moderator with `can_edit`. */
  canEdit: boolean;
  /** A Report button makes sense: `reports` is on, the record is public and not the visitor's. */
  canReport: boolean;
}

/** The permissions route's answer, as `fetch` returns it. */
export interface ContentPermissionsResponse<TId extends number | string> {
  items: (ContentPermissions & { id: TId })[];
}

const NO_PERMISSIONS: ContentPermissions = {
  canEdit: false,
  canReport: false,
};

/** Batches in flight at once for one hook. */
const MAX_CONCURRENT_BATCHES = 3;

/**
 * `ids` without duplicates, in the order given, cut into batches the
 * permissions route accepts. Each batch is sorted, so the same records keep
 * the same query key, and appending ids leaves the earlier batches - and their
 * cached answers - alone.
 */
export const contentPermissionBatches = <TId extends number | string>(
  ids: readonly TId[],
  size: number = CONTENT_PUBLIC_MAX_PAGE_SIZE,
): TId[][] => {
  const seen = new Set<string>();
  const unique = ids.filter(id => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
  const batches: TId[][] = [];
  for (let start = 0; start < unique.length; start += size) {
    batches.push(
      unique
        .slice(start, start + size)
        .sort((a, b) => String(a).localeCompare(String(b))),
    );
  }

  return batches;
};

/** Runs at most `max` tasks at once; the rest wait their turn in order. */
const createLimiter = (max: number) => {
  let active = 0;
  const waiting: (() => void)[] = [];

  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active < max) {
      active++;
    } else {
      // The finishing task hands its slot over, so `active` never exceeds `max`.
      await new Promise<void>(resolve => {
        waiting.push(resolve);
      });
    }

    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
};

const combineBatches = <TId extends number | string>(
  results: UseQueryResult<ContentPermissionsResponse<TId>>[],
) => ({
  byId: new Map(
    results.flatMap(result =>
      (result.data?.items ?? []).map(item => [String(item.id), item] as const),
    ),
  ),
  isError: results.some(result => result.isError),
  isPending: results.some(result => result.isPending),
});

/**
 * Asks the Content Engine what the signed-in visitor may do with some records
 * - one detail page or a whole thread - so a page never compares author ids or
 * guesses moderator rights. Every answer starts with `can`, and a record not
 * answered yet, left out by the server or in a failed batch reads as all
 * `false`.
 *
 * Any number of `ids` works: duplicates are dropped and the rest go out in
 * batches of `CONTENT_PUBLIC_MAX_PAGE_SIZE` (50), the route's limit, at most
 * three at a time. Each batch is its own query, so ids appended by "Load more"
 * only fetch their own batches.
 *
 * Browser-only: it waits for the session, and the user id is part of every
 * query key, so a cached page still shows each visitor their own buttons and
 * signing in or out asks again. Write the `fetcher` call inline in `fetch`, so
 * the route stays typed. The `queryKey` prefix is the list's, so invalidating
 * the list after a write refreshes the permissions too.
 *
 * @example
 * ```tsx
 * import { useContentPermissions } from "@vitnode/core/tanstack/content";
 * import { fetcher } from "@vitnode/core/tanstack/fetcher";
 *
 * const permissions = useContentPermissions({
 *   ids: [discussion.id],
 *   queryKey: [manifest.id, "discussions"],
 *   fetch: async ids => {
 *     const res = await fetcher({
 *       plugin: manifest.id,
 *       method: "get",
 *       module: "content/discussions",
 *       path: "/permissions",
 *       args: { query: { ids: ids.join(",") } },
 *     });
 *     if (res.status !== 200) throw new Error("Loading permissions failed.");
 *
 *     return await res.json();
 *   },
 * });
 *
 * permissions.of(discussion.id).canEdit;
 * ```
 */
export const useContentPermissions = <TId extends number | string>({
  fetch,
  ids,
  queryKey,
}: {
  /**
   * Calls `GET /{publicApi.path}/permissions` with `ids` joined by commas.
   * Gets at most 50 ids per call. Throw on anything but `200`.
   */
  fetch: (ids: TId[]) => Promise<ContentPermissionsResponse<TId>>;
  /** The records on screen, any number and in any order. */
  ids: readonly TId[];
  /** The prefix of the content type's queries, e.g. `[manifest.id, "discussions"]`. */
  queryKey: QueryKey;
}) => {
  const session = useSessionQuery();
  const userId = session.data?.user?.id ?? null;
  const [limit] = React.useState(() => createLimiter(MAX_CONCURRENT_BATCHES));

  const batches = useQueries({
    combine: combineBatches<TId>,
    queries: contentPermissionBatches(ids).map(batch => ({
      enabled: !session.isPending,
      queryFn: async () => await limit(async () => await fetch(batch)),
      queryKey: [...queryKey, "permissions", { ids: batch, userId }],
      retry: false,
    })),
  });

  // Stable until an answer changes, so memoized rows that receive it skip
  // re-rendering.
  const of = React.useCallback(
    (id: TId): ContentPermissions => {
      const item = batches.byId.get(String(id));

      return item
        ? { canEdit: item.canEdit, canReport: item.canReport }
        : NO_PERMISSIONS;
    },
    [batches.byId],
  );

  return {
    /** `true` when a batch failed; its records read as all `false`. */
    isError: batches.isError,
    /** `true` while the session or any batch waits for its first answer. */
    isPending: session.isPending || batches.isPending,
    /** The permissions of one record, all `false` until known. */
    of,
  };
};
