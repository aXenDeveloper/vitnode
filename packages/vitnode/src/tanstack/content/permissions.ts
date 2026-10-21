import type { QueryKey } from "@tanstack/react-query";

import { useQuery } from "@tanstack/react-query";
import React from "react";

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

/**
 * Asks the Content Engine what the signed-in visitor may do with some records
 * - one detail page or a whole list in one request - so a page never compares
 * author ids or guesses moderator rights. Every answer starts with `can`, and
 * a record not answered yet, or left out, reads as all `false`.
 *
 * Browser-only: it waits for the session, and it refetches when somebody signs
 * in or out, so a cached page still shows each visitor their own buttons. Write
 * the `fetcher` call inline in `fetch`, so the route stays typed. The
 * `queryKey` prefix is the list's, so invalidating the list after a write
 * refreshes the permissions too.
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
  /** Calls `GET /{publicApi.path}/permissions` with `ids` joined by commas. */
  fetch: (ids: TId[]) => Promise<ContentPermissionsResponse<TId>>;
  /** The records on screen, at most 50. */
  ids: readonly TId[];
  /** The prefix of the content type's queries, e.g. `[manifest.id, "discussions"]`. */
  queryKey: QueryKey;
}) => {
  const session = useSessionQuery();
  const userId = session.data?.user?.id ?? null;
  const unique = [...new Set(ids)].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );

  const query = useQuery({
    enabled: !session.isPending && unique.length > 0,
    queryFn: async () => await fetch(unique),
    queryKey: [...queryKey, "permissions", { ids: unique, userId }],
    retry: false,
  });

  const byId = React.useMemo(
    () => new Map(query.data?.items.map(item => [String(item.id), item])),
    [query.data],
  );

  // Stable until the answer changes, so memoized rows that receive it skip
  // re-rendering.
  const of = React.useCallback(
    (id: TId): ContentPermissions => {
      const item = byId.get(String(id));

      return item
        ? { canEdit: item.canEdit, canReport: item.canReport }
        : NO_PERMISSIONS;
    },
    [byId],
  );

  return {
    /** `true` until the first answer arrives. */
    isPending: query.isPending,
    /** The permissions of one record, all `false` until known. */
    of,
  };
};
