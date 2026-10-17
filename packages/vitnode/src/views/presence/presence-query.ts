import { queryOptions } from "@tanstack/react-query";

import { OPERATIONAL_STALE_TIME } from "@/lib/query-freshness";
import {
  PRESENCE_BATCH_MAX_USERS,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  type UserPresence,
} from "@/lib/user-presence";
import { manifest } from "@/manifest";
import { fetcher } from "@/tanstack/fetcher";

/** Every presence query - invalidate it after a privacy change. */
export const PRESENCE_QUERY_ROOT = ["vitnode", "presence"] as const;

/**
 * Who is looking is part of the key: the same member reads differently to a
 * guest, to themselves and to a moderator, and one answer must never be served
 * to another viewer.
 */
const viewerKey = (viewerId: null | number) => viewerId ?? "guest";

export class PresenceRequestError extends Error {
  constructor(status: number) {
    super(`The presence API answered ${status}.`);
    this.name = "PresenceRequestError";
    this.status = status;
  }

  readonly status: number;
}

export const fetchUserPresence = async (
  userId: number,
): Promise<UserPresence> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { params: { id: String(userId) } },
    method: "get",
    module: "users",
    path: "/{id}/presence",
  });
  if (!response.ok) throw new PresenceRequestError(response.status);

  return await response.json();
};

export const fetchUserPresences = async (
  userIds: readonly number[],
): Promise<Record<number, UserPresence>> => {
  const chunks: number[][] = [];
  for (
    let start = 0;
    start < userIds.length;
    start += PRESENCE_BATCH_MAX_USERS
  ) {
    chunks.push(userIds.slice(start, start + PRESENCE_BATCH_MAX_USERS));
  }

  const answers = await Promise.all(
    chunks.map(async chunk => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { body: { userIds: chunk } },
        method: "post",
        module: "users",
        path: "/presence/batch",
      });
      if (!response.ok) throw new PresenceRequestError(response.status);

      return (await response.json()).presences;
    }),
  );

  return Object.fromEntries(
    answers.flat().map(({ presence, userId }) => [userId, presence]),
  );
};

/** Shared by every presence query: refreshed once a minute, never while the tab is hidden. */
const LIVE_PRESENCE = {
  refetchInterval: PRESENCE_HEARTBEAT_INTERVAL_MS,
  refetchIntervalInBackground: false,
  retry: false,
  staleTime: OPERATIONAL_STALE_TIME,
} as const;

/**
 * One member's presence. Fetch it in the browser only - never in a loader -
 * so it stays out of SSR output and the page cache.
 */
export const userPresenceQueryOptions = ({
  userId,
  viewerId,
}: {
  userId: number;
  viewerId: null | number;
}) =>
  queryOptions({
    ...LIVE_PRESENCE,
    queryFn: async () => await fetchUserPresence(userId),
    queryKey: [...PRESENCE_QUERY_ROOT, viewerKey(viewerId), "user", userId],
  });

/**
 * Many members' presence, keyed by user ID - one request per
 * {@link PRESENCE_BATCH_MAX_USERS} members, however long the list.
 */
export const userPresencesQueryOptions = ({
  userIds,
  viewerId,
}: {
  userIds: readonly number[];
  viewerId: null | number;
}) => {
  const ids = [...new Set(userIds)].sort((a, b) => a - b);

  return queryOptions({
    ...LIVE_PRESENCE,
    enabled: ids.length > 0,
    queryFn: async () => await fetchUserPresences(ids),
    queryKey: [...PRESENCE_QUERY_ROOT, viewerKey(viewerId), "batch", ids],
  });
};
