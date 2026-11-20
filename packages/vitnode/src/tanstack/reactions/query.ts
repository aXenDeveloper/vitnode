import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ContentTarget } from "@vitnode/api/content/target";

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { REACTIONS_LIMITS } from "@vitnode/api/lib/reactions/const";

import { fetcher } from "@/tanstack/fetcher";

/** One target's reactions for the current visitor, as `GET /reactions` answers. */
export interface ReactionSummary {
  canReact: boolean;
  counts: { code: string; count: number }[];
  id: string;
  seq: number;
  total: number;
  viewer: string[];
}

/** A failed read or write, with the API's error code when it sent one. */
export class ReactionsRequestError extends Error {
  constructor(status: number, code: string, resetsAt: null | string = null) {
    super(code);
    this.name = "ReactionsRequestError";
    this.status = status;
    this.code = code;
    this.resetsAt = resetsAt;
  }

  readonly code: string;
  readonly resetsAt: null | string;
  readonly status: number;
}

export const REACTIONS_QUERY_ROOT = ["@vitnode/core", "reactions"] as const;

/** The catalog and what the viewer's roles allow; keyed by viewer so it never leaks across sign-ins. */
export const reactionsCatalogQueryOptions = (viewerId: null | number) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const response = await fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "reactions",
        path: "/catalog",
        options: { signal },
      });
      if (!response.ok) {
        throw new ReactionsRequestError(response.status, "load_failed");
      }

      return await response.json();
    },
    queryKey: [...REACTIONS_QUERY_ROOT, "catalog", viewerId] as const,
    staleTime: 60_000,
  });

export type ReactionsCatalog = Awaited<
  ReturnType<
    NonNullable<ReturnType<typeof reactionsCatalogQueryOptions>["queryFn"]>
  >
>;

export type ReactionCatalogItem = ReactionsCatalog["items"][number];

export const reactionSummaryQueryKey = (
  target: ContentTarget,
  viewerId: null | number,
) =>
  [
    ...REACTIONS_QUERY_ROOT,
    "summary",
    viewerId,
    target.pluginId,
    target.type,
    target.id,
  ] as const;

interface SummaryWaiter {
  reject: (error: unknown) => void;
  resolve: (value: ReactionSummary) => void;
}

interface PendingBatch {
  ids: Map<string, SummaryWaiter[]>;
  pluginId: string;
  type: string;
}

const batches = new Map<string, PendingBatch>();

const loadChunk = async (
  { pluginId, type }: PendingBatch,
  chunk: [string, SummaryWaiter[]][],
): Promise<void> => {
  try {
    const response = await fetcher({
      plugin: "@vitnode/core",
      method: "get",
      module: "reactions",
      path: "/",
      args: {
        query: { ids: chunk.map(([id]) => id).join(","), pluginId, type },
      },
    });
    if (!response.ok) {
      throw new ReactionsRequestError(response.status, "load_failed");
    }
    const { items } = await response.json();
    const byId = new Map(items.map(item => [item.id, item]));
    for (const [id, waiters] of chunk) {
      const item = byId.get(id);
      for (const waiter of waiters) {
        if (item) waiter.resolve(item);
        else waiter.reject(new ReactionsRequestError(404, "not_found"));
      }
    }
  } catch (error) {
    for (const [, waiters] of chunk) {
      for (const waiter of waiters) waiter.reject(error);
    }
  }
};

const runBatch = async (batch: PendingBatch): Promise<void> => {
  const entries = [...batch.ids];
  const chunks: (typeof entries)[] = [];
  for (
    let index = 0;
    index < entries.length;
    index += REACTIONS_LIMITS.idsPerRequest
  ) {
    chunks.push(entries.slice(index, index + REACTIONS_LIMITS.idsPerRequest));
  }
  await Promise.all(chunks.map(async chunk => await loadChunk(batch, chunk)));
};

/**
 * One target's summary. Every call in the same tick for the same plugin and
 * type joins one `GET /reactions?ids=...` per 100 targets, sent in parallel,
 * so a thread of 50 comments makes one request.
 */
export const loadReactionSummary = async (
  target: ContentTarget,
): Promise<ReactionSummary> =>
  await new Promise<ReactionSummary>((resolve, reject) => {
    const key = `${target.pluginId}\u0000${target.type}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { ids: new Map(), pluginId: target.pluginId, type: target.type };
      batches.set(key, batch);
      const scheduled = batch;
      queueMicrotask(() => {
        batches.delete(key);
        void runBatch(scheduled);
      });
    }
    batch.ids.set(target.id, [
      ...(batch.ids.get(target.id) ?? []),
      { reject, resolve },
    ]);
  });

export const reactionSummaryQueryOptions = (
  target: ContentTarget,
  viewerId: null | number,
) =>
  queryOptions({
    queryFn: async () => await loadReactionSummary(target),
    queryKey: reactionSummaryQueryKey(target, viewerId),
    staleTime: 30_000,
  });

/** Whether `queryKey` is {@link reactionSummaryQueryKey} of `target`, for any viewer. */
export const isReactionSummaryKeyOf = (
  queryKey: QueryKey,
  target: ContentTarget,
): boolean =>
  queryKey[0] === REACTIONS_QUERY_ROOT[0] &&
  queryKey[1] === REACTIONS_QUERY_ROOT[1] &&
  queryKey[2] === "summary" &&
  queryKey[4] === target.pluginId &&
  queryKey[5] === target.type &&
  queryKey[6] === target.id;

/** Writes a summary from a live message, keeping the viewer's own part. Drops stale ones. */
export const applyLiveCounts = (
  queryClient: QueryClient,
  target: ContentTarget,
  counts: Pick<ReactionSummary, "counts" | "seq" | "total">,
): void => {
  const entries = queryClient.getQueriesData<ReactionSummary>({
    predicate: query => isReactionSummaryKeyOf(query.queryKey, target),
  });
  const counted = new Set(counts.counts.map(item => item.code));
  for (const [key, value] of entries) {
    if (!value || value.seq >= counts.seq) continue;
    const viewer = value.viewer.filter(code => counted.has(code));
    queryClient.setQueryData<ReactionSummary>(key, {
      ...value,
      counts: counts.counts,
      seq: counts.seq,
      total: counts.total,
      viewer: viewer.length === value.viewer.length ? value.viewer : viewer,
    });
  }
};

/** The summary a toggle should show right away, before the server answers. */
export const optimisticToggle = (
  summary: ReactionSummary,
  code: string,
  maxPerItem: null | number,
): ReactionSummary => {
  const counts = new Map(summary.counts.map(item => [item.code, item.count]));
  const bump = (key: string, delta: number) => {
    const next = (counts.get(key) ?? 0) + delta;
    if (next > 0) counts.set(key, next);
    else counts.delete(key);
  };

  let viewer: string[];
  if (summary.viewer.includes(code)) {
    bump(code, -1);
    viewer = summary.viewer.filter(item => item !== code);
  } else if (maxPerItem === 1 && summary.viewer.length > 0) {
    for (const previous of summary.viewer) bump(previous, -1);
    bump(code, 1);
    viewer = [code];
  } else {
    bump(code, 1);
    viewer = [...summary.viewer, code];
  }

  const previousOrder = summary.counts.map(item => item.code);
  const known = new Set(previousOrder);
  const order = [
    ...previousOrder,
    ...[...counts.keys()].filter(key => !known.has(key)),
  ];
  const nextCounts = order.flatMap(key => {
    const count = counts.get(key);

    return count ? [{ code: key, count }] : [];
  });

  return {
    ...summary,
    counts: nextCounts,
    total: nextCounts.reduce((sum, item) => sum + item.count, 0),
    viewer,
  };
};

/** Adds or removes the viewer's `code` on one target. Throws {@link ReactionsRequestError}. */
export const toggleReaction = async (
  target: ContentTarget,
  { code, remove }: { code: string; remove: boolean },
): Promise<ReactionSummary> => {
  const response = remove
    ? await fetcher({
        plugin: "@vitnode/core",
        method: "delete",
        module: "reactions",
        path: "/",
        args: {
          query: {
            id: target.id,
            pluginId: target.pluginId,
            reaction: code,
            type: target.type,
          },
        },
      })
    : await fetcher({
        plugin: "@vitnode/core",
        method: "put",
        module: "reactions",
        path: "/",
        args: {
          body: {
            id: target.id,
            pluginId: target.pluginId,
            reaction: code,
            type: target.type,
          },
        },
      });

  if (response.ok) return await response.json();

  const body = (await response.json().catch(() => null)) as null | {
    error?: string;
    resetsAt?: null | string;
  };
  throw new ReactionsRequestError(
    response.status,
    body?.error ?? "generic",
    body?.resetsAt ?? null,
  );
};

/** A reaction's title in `locale`, else the first one, else its code. */
export const reactionTitle = (
  reaction: { code: string; title: { languageCode: string; value: string }[] },
  locale: string,
): string =>
  reaction.title.find(item => item.languageCode === locale)?.value ??
  reaction.title[0]?.value ??
  reaction.code;

/** Who reacted to one item, newest first, optionally one reaction. Universal. */
export const whoReactedQueryOptions = (
  target: ContentTarget,
  reaction: null | string,
) =>
  infiniteQueryOptions({
    getNextPageParam: (page: { nextCursor: null | string }) =>
      page.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const response = await fetcher({
        plugin: "@vitnode/core",
        method: "get",
        module: "reactions",
        path: "/users",
        args: {
          query: {
            id: target.id,
            pluginId: target.pluginId,
            type: target.type,
            ...(reaction ? { reaction } : {}),
            ...(pageParam ? { cursor: pageParam } : {}),
          },
        },
        options: { signal },
      });
      if (!response.ok) {
        throw new ReactionsRequestError(response.status, "load_failed");
      }

      return await response.json();
    },
    queryKey: [
      ...REACTIONS_QUERY_ROOT,
      "users",
      target.pluginId,
      target.type,
      target.id,
      reaction,
    ] as const,
    staleTime: 30_000,
  });
