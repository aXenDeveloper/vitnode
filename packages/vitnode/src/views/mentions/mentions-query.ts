import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { manifest } from "@vitnode/api/manifest";

import { RECORD_STALE_TIME } from "@/lib/query-freshness";
import { fetcher } from "@/tanstack/fetcher";

/** Every mention query. */
export const MENTIONS_QUERY_ROOT = ["vitnode", "mentions"] as const;

/** Most ids one `GET /users/mentioned` call resolves - `MENTIONED_USERS_MAX_IDS` in the API. */
const MENTIONED_BATCH_MAX = 50;

/** How long lookups wait for others to join one request. */
const MENTIONED_BATCH_WINDOW_MS = 10;

export class MentionsRequestError extends Error {
  constructor(status: number) {
    super(`The mentions API answered ${status}.`);
    this.name = "MentionsRequestError";
    this.status = status;
  }

  readonly status: number;
}

/** Members matching what was typed after `@`, for the editor's popup. */
export const mentionSuggestionsQueryOptions = (search: string) =>
  queryOptions({
    enabled: search !== "",
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: manifest.id,
        args: { query: { search } },
        method: "get",
        module: "users",
        options: { signal },
        path: "/mentions",
      });
      if (!response.ok) throw new MentionsRequestError(response.status);

      return (await response.json()).users;
    },
    queryKey: [...MENTIONS_QUERY_ROOT, "suggestions", search] as const,
    retry: false,
    staleTime: RECORD_STALE_TIME,
  });

/** A mentioned member's current name and URL name. */
export interface MentionedUser {
  id: number;
  name: string;
  nameCode: string;
}

interface PendingLookup {
  reject: (error: unknown) => void;
  resolve: (user: MentionedUser | null) => void;
}

// Browser-only: the lookup runs from `useQuery`, which never fetches during
// SSR, so this queue never holds two visitors' ids.
const pending = new Map<number, PendingLookup[]>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

const fetchMentionedUsers = async (
  ids: readonly number[],
): Promise<Map<number, MentionedUser>> => {
  const response = await fetcher({
    plugin: manifest.id,
    args: { query: { ids: ids.join(",") } },
    method: "get",
    module: "users",
    path: "/mentioned",
  });
  if (!response.ok) throw new MentionsRequestError(response.status);

  const { users } = await response.json();

  return new Map(users.map(user => [user.id, user]));
};

const flush = () => {
  flushTimer = undefined;
  const batch = [...pending.entries()];
  pending.clear();

  for (let start = 0; start < batch.length; start += MENTIONED_BATCH_MAX) {
    const chunk = batch.slice(start, start + MENTIONED_BATCH_MAX);
    const ids = chunk.map(([id]) => id).sort((a, b) => a - b);

    fetchMentionedUsers(ids).then(
      users => {
        for (const [id, lookups] of chunk) {
          for (const lookup of lookups) lookup.resolve(users.get(id) ?? null);
        }
      },
      (error: unknown) => {
        for (const [, lookups] of chunk) {
          for (const lookup of lookups) lookup.reject(error);
        }
      },
    );
  }
};

/**
 * One member's current name, fetched together with every other mention that
 * asks within the same few milliseconds - a page of comments sends one
 * request, not one per mention. Resolves `null` for a deleted member.
 */
const loadMentionedUser = async (id: number): Promise<MentionedUser | null> =>
  await new Promise((resolve, reject) => {
    const lookups = pending.get(id) ?? [];
    lookups.push({ reject, resolve });
    pending.set(id, lookups);
    flushTimer ??= setTimeout(flush, MENTIONED_BATCH_WINDOW_MS);
  });

/**
 * The current name and URL name of a mentioned member, so a mention follows
 * renames. Read it in the browser only - the snapshot stored in the mention
 * is what SSR renders.
 */
export const mentionedUserQueryOptions = (id: number) =>
  queryOptions({
    queryFn: async () => await loadMentionedUser(id),
    queryKey: [...MENTIONS_QUERY_ROOT, "user", id] as const,
    retry: false,
    staleTime: 5 * 60_000,
  });
