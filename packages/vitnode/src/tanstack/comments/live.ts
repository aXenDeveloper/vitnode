import type {
  InfiniteData,
  QueryCacheNotifyEvent,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

import { hashKey } from "@tanstack/react-query";

import type { ContentId } from "@/content/ids";
import type { ContentRefreshSignal } from "@/content/live/refresh";

import {
  CONTENT_REFRESH_DEBOUNCE_MS,
  CONTENT_REFRESH_MAX_WAIT_MS,
  CONTENT_THREAD_BRANCHES_MAX,
} from "@/content/live/refresh";
import { createCoalescer } from "@/lib/coalesce";

import type {
  ContentCommentNode,
  ContentCommentsBranches,
  ContentCommentsThreadPage,
} from "./thread";

/** A thread read that did not answer `2xx`, with the status it answered. */
export class ContentCommentsRequestError extends Error {
  constructor(status: number, message: string) {
    super(message);
    this.name = "ContentCommentsRequestError";
    this.status = status;
  }

  readonly status: number;
}

/** `401`, `403` and `404`: the reader may no longer see this thread at all. */
export const isContentCommentsAccessError = (error: unknown): boolean =>
  error instanceof ContentCommentsRequestError &&
  (error.status === 401 || error.status === 403 || error.status === 404);

export type ContentCommentsData<TRecord, TId extends ContentId> = InfiniteData<
  ContentCommentsThreadPage<TRecord, TId>,
  null | string
>;

/** Concurrent `GET /thread/branches` requests one thread sends at most. */
export const CONTENT_COMMENTS_MAX_BRANCH_REQUESTS = 2;

/** Spreads the reads of every viewer of a busy thread after a server restart. */
const RECONNECT_JITTER_MS = 1_500;

const keyOf = (id: ContentId): string => String(id);

/**
 * Puts nodes the reader is typing in back into a branch that lost them, as
 * `removed` with their old record, so the open editor keeps its text and can
 * say why it can no longer be sent. Pure.
 */
const keepDrafts = <TRecord, TId extends ContentId>(
  before: ContentCommentNode<TRecord, TId>[],
  after: ContentCommentNode<TRecord, TId>[],
  drafts: ReadonlySet<string>,
): ContentCommentNode<TRecord, TId>[] => {
  if (drafts.size === 0) return after;
  const next = [...after];

  for (const node of before) {
    const key = keyOf(node.id);
    if (!drafts.has(key) || node.record === null) continue;

    const index = next.findIndex(item => keyOf(item.id) === key);
    const current = index === -1 ? undefined : next[index];
    if (current && current.record !== null) continue;
    const kept = { ...node, removed: true };
    if (current) {
      next[index] = kept;
      continue;
    }
    const parentKey = node.parentId === null ? null : keyOf(node.parentId);
    const parentIndex =
      parentKey === null
        ? -1
        : next.findIndex(item => keyOf(item.id) === parentKey);
    next.splice(parentIndex === -1 ? next.length : parentIndex + 1, 0, kept);
  }

  return next;
};

/**
 * Replaces each answered top-level branch where it sits in the loaded pages
 * and drops the `gone` ones, keeping every other page, item and page param
 * as it was - so cursors stay valid and nothing moves across a page
 * boundary. Branches that are not loaded are left alone; the counts of every
 * page take the answer's. Pure.
 */
export const mergeContentCommentBranches = <TRecord, TId extends ContentId>(
  data: ContentCommentsData<TRecord, TId>,
  result: ContentCommentsBranches<TRecord, TId>,
  {
    drafts = new Set<string>(),
    skip = () => false,
  }: {
    /** Ids with an open editor, see `keepDrafts`. */
    drafts?: ReadonlySet<string>;
    /** Branches a newer answer already replaced. */
    skip?: (branchKey: string) => boolean;
  } = {},
): ContentCommentsData<TRecord, TId> => {
  const answers = new Map(
    result.branches
      .filter(branch => !skip(keyOf(branch.id)))
      .map(branch => [keyOf(branch.id), branch]),
  );

  const pages = data.pages.map(page => {
    let changed = false;
    const items: ContentCommentNode<TRecord, TId>[] = [];
    let index = 0;
    while (index < page.items.length) {
      const item = page.items[index];
      const answer = item.depth === 1 ? answers.get(keyOf(item.id)) : undefined;
      let end = index + 1;
      while (end < page.items.length && page.items[end].depth > 1) end++;

      if (answer) {
        changed = true;
        items.push(
          ...keepDrafts(
            page.items.slice(index, end),
            answer.status === "ok" ? answer.items : [],
            drafts,
          ),
        );
      } else {
        items.push(...page.items.slice(index, end));
      }
      index = end;
    }

    return {
      ...page,
      items: changed ? items : page.items,
      pageInfo: { ...page.pageInfo, totalCount: result.pageInfo.totalCount },
      replyCount: result.replyCount,
      truncated: page.truncated || (changed && result.truncated),
    };
  });

  return { ...data, pages };
};

/** Every top-level id on the loaded pages. */
const loadedBranches = <TRecord, TId extends ContentId>(
  data: ContentCommentsData<TRecord, TId> | undefined,
): Set<string> =>
  new Set(
    (data?.pages ?? []).flatMap(page =>
      page.items.filter(item => item.depth === 1).map(item => keyOf(item.id)),
    ),
  );

/**
 * Appends the comments that came after the last loaded one as a new page,
 * leaving out branches already on screen. An empty thread's only page is
 * replaced instead. Pure.
 */
export const appendContentCommentsTail = <TRecord, TId extends ContentId>(
  data: ContentCommentsData<TRecord, TId>,
  tail: ContentCommentsThreadPage<TRecord, TId>,
  after: null | string,
): ContentCommentsData<TRecord, TId> => {
  if (after === null) {
    return { pageParams: [null], pages: [tail] };
  }

  const counted = data.pages.map(page => ({
    ...page,
    pageInfo: { ...page.pageInfo, totalCount: tail.pageInfo.totalCount },
    replyCount: tail.replyCount,
  }));
  const loaded = loadedBranches(data);
  const items: ContentCommentNode<TRecord, TId>[] = [];
  let skipping = false;
  for (const item of tail.items) {
    if (item.depth === 1) skipping = loaded.has(keyOf(item.id));
    if (!skipping) items.push(item);
  }
  if (items.length === 0 && !tail.pageInfo.hasNextPage) {
    return { ...data, pages: counted };
  }

  return {
    pageParams: [...data.pageParams, after],
    pages: [...counted, { ...tail, items }],
  };
};

/** The last cursor of the loaded pages, `null` before any comment. */
const tailCursor = <TRecord, TId extends ContentId>(
  data: ContentCommentsData<TRecord, TId>,
): null | string => {
  for (const page of data.pages.toReversed()) {
    if (page.pageInfo.endCursor !== null) return page.pageInfo.endCursor;
  }

  return null;
};

export interface ContentCommentsLiveSnapshot {
  /** A comment appeared after the loaded ones, at the end of the thread. */
  hasNew: boolean;
  /** A background refresh failed; what is on screen may be out of date. */
  refreshError: boolean;
}

/** How a live thread reads, installed with `setSource` once mounted. */
export interface ContentCommentsLiveSource<TRecord, TId extends ContentId> {
  /** Called right before the loaded thread changes, to hold the scroll position. */
  beforeChange?: () => void;
  /** `GET /thread/branches` - throws `ContentCommentsRequestError` on a refusal. */
  readBranches: (ids: TId[]) => Promise<ContentCommentsBranches<TRecord, TId>>;
  /** `GET /thread` after a cursor - throws `ContentCommentsRequestError` on a refusal. */
  readPage: (
    after: null | string,
  ) => Promise<ContentCommentsThreadPage<TRecord, TId>>;
}

export interface ContentCommentsLiveOptions {
  debounceMs?: number;
  maxRequests?: number;
  maxWaitMs?: number;
  /** The permissions cache prefix, refreshed for every branch that changed. */
  permissionsKey: QueryKey;
  queryClient: QueryClient;
  /** The thread's infinite query key. */
  threadKey: QueryKey;
}

const DETACHED = async (): Promise<never> =>
  await Promise.reject(
    new ContentCommentsRequestError(0, "The live thread has no source yet."),
  );

/**
 * Keeps a loaded comment thread current from live signals, at a predictable
 * cost:
 *
 * - A change in a loaded branch re-reads only that branch, through
 *   `/thread/branches`, and merges it in place. Changes to the same branches
 *   within `debounceMs` (at most `maxWaitMs`) share one request; at most
 *   `maxRequests` run at once, never two for the same branch.
 * - A change in a branch that is not loaded is not fetched. At the end of the
 *   thread it raises `hasNew`, and `showNew()` reads only what follows the
 *   last loaded comment; before the end, "Load more" will read it anyway.
 * - Nothing is merged while the thread query fetches - an infinite fetch
 *   writes back the pages it started from - and an answer that started
 *   before a full refetch is dropped and asked again.
 * - `reconcile()` re-reads the loaded pages, for a (re)join, a root change
 *   and a revoked subscription. A `401`, `403` or `404` from any read resets
 *   the thread, so nothing the reader lost access to stays on screen.
 *
 * Framework-free; `useContentComments` drives it. Browser-only in practice.
 */
export const createContentCommentsLive = <TRecord, TId extends ContentId>({
  debounceMs = CONTENT_REFRESH_DEBOUNCE_MS,
  maxRequests = CONTENT_COMMENTS_MAX_BRANCH_REQUESTS,
  maxWaitMs = CONTENT_REFRESH_MAX_WAIT_MS,
  permissionsKey,
  queryClient,
  threadKey,
}: ContentCommentsLiveOptions) => {
  type Data = ContentCommentsData<TRecord, TId>;

  let source: ContentCommentsLiveSource<TRecord, TId> = {
    readBranches: DETACHED,
    readPage: DETACHED,
  };
  const beforeChange = (): void => {
    source.beforeChange?.();
  };

  const threadHash = hashKey(threadKey);
  const ids = new Map<string, TId>();
  const dirty = new Set<string>();
  const inFlight = new Map<string, Promise<void>>();
  const applied = new Map<string, number>();
  const removals = new Map<string, Set<string>>();
  const failed = new Set<string>();
  const newBranches = new Set<string>();
  const drafts = new Map<string, number>();
  const idleWaiters: (() => void)[] = [];
  const listeners = new Set<() => void>();
  let snapshot: ContentCommentsLiveSnapshot = {
    hasNew: false,
    refreshError: false,
  };
  let epoch = 0;
  let sequence = 0;
  let active = 0;
  let disposed = false;
  let reconcileTimer: ReturnType<typeof setTimeout> | undefined;

  const setSnapshot = (next: Partial<ContentCommentsLiveSnapshot>): void => {
    const merged = { ...snapshot, ...next };
    if (
      merged.hasNew === snapshot.hasNew &&
      merged.refreshError === snapshot.refreshError
    ) {
      return;
    }
    snapshot = merged;
    listeners.forEach(listener => listener());
  };

  const query = () => queryClient.getQueryCache().get(threadHash);
  const data = (): Data | undefined =>
    queryClient.getQueryData<Data>(threadKey);
  const isFetching = (): boolean => query()?.state.fetchStatus === "fetching";

  /** Resolves once the thread query is not fetching. */
  const idle = async (): Promise<void> => {
    if (!isFetching()) return;
    await new Promise<void>(resolve => {
      idleWaiters.push(resolve);
    });
  };

  const draftKeys = (): Set<string> => new Set(drafts.keys());

  const findNode = (key: string) =>
    data()
      ?.pages.flatMap(page => page.items)
      .find(item => keyOf(item.id) === key);

  /** The top-level id a loaded comment hangs from. */
  const branchOf = (id: ContentId): null | string => {
    const items = new Map(
      (data()?.pages ?? []).flatMap(page =>
        page.items.map(item => [keyOf(item.id), item] as const),
      ),
    );
    let node = items.get(keyOf(id));
    for (let hop = 0; node && hop < 64; hop++) {
      if (node.depth === 1 || node.parentId === null) return keyOf(node.id);
      node = items.get(keyOf(node.parentId));
    }

    return null;
  };

  const loseAccess = async (): Promise<void> => {
    dirty.clear();
    removals.clear();
    failed.clear();
    newBranches.clear();
    setSnapshot({ hasNew: false, refreshError: false });
    beforeChange();
    await queryClient.resetQueries({ exact: true, queryKey: threadKey });
  };

  /** Takes removed comments off screen when their branch could not be read. */
  const applyRemovals = (keys: string[]): void => {
    const gone = new Set(keys.flatMap(key => [...(removals.get(key) ?? [])]));
    if (gone.size === 0) return;
    beforeChange();
    queryClient.setQueryData<Data>(threadKey, old =>
      old
        ? {
            ...old,
            pages: old.pages.map(page => ({
              ...page,
              items: page.items.flatMap(item => {
                const key = keyOf(item.id);
                if (!gone.has(key)) return [item];
                const hasReplies = page.items.some(
                  child =>
                    child.parentId !== null && keyOf(child.parentId) === key,
                );

                return hasReplies
                  ? [
                      {
                        ...item,
                        deleted: null,
                        hidden: false,
                        hiddenReason: null,
                        record: null,
                        removed: true,
                      },
                    ]
                  : [];
              }),
            })),
          }
        : old,
    );
  };

  const refreshPermissions = (keys: Set<string>): void => {
    if (keys.size === 0) return;
    void queryClient.invalidateQueries({
      predicate: candidate => {
        const batch = candidate.queryKey.at(-1);

        return (
          typeof batch === "object" &&
          batch !== null &&
          "ids" in batch &&
          Array.isArray(batch.ids) &&
          batch.ids.some(id => keys.has(keyOf(id as ContentId)))
        );
      },
      queryKey: permissionsKey,
    });
  };

  const apply = (
    keys: string[],
    result: ContentCommentsBranches<TRecord, TId>,
    request: number,
  ): void => {
    const before = data();
    if (!before) return;
    const touched = new Set<string>();
    const answered = new Set(result.branches.map(branch => keyOf(branch.id)));
    for (const page of before.pages) {
      let branch: null | string = null;
      for (const item of page.items) {
        if (item.depth === 1) branch = keyOf(item.id);
        if (branch !== null && answered.has(branch)) {
          touched.add(keyOf(item.id));
        }
      }
    }
    for (const branch of result.branches) {
      if (branch.status === "ok") {
        branch.items.forEach(item => touched.add(keyOf(item.id)));
      }
    }

    if (touched.size > 0) beforeChange();
    queryClient.setQueryData<Data>(threadKey, old =>
      old
        ? mergeContentCommentBranches(old, result, {
            drafts: draftKeys(),
            skip: key => (applied.get(key) ?? 0) > request,
          })
        : old,
    );
    for (const key of keys) {
      applied.set(key, request);
      removals.delete(key);
      failed.delete(key);
    }
    if (failed.size === 0) setSnapshot({ refreshError: false });
    refreshPermissions(touched);
  };

  /** One `/thread/branches` request; resolves once its answer is merged. */
  const request = async (keys: string[]): Promise<void> => {
    const current = ++sequence;
    const startedIn = epoch;
    active++;
    const task = (async () => {
      try {
        const result = await source.readBranches(
          keys.flatMap(key => {
            const id = ids.get(key);

            return id === undefined ? [] : [id];
          }),
        );
        await idle();
        if (disposed) return;
        if (startedIn !== epoch) {
          // A full refetch began meanwhile and may have newer rows.
          keys.forEach(key => dirty.add(key));

          return;
        }
        apply(keys, result, current);
      } catch (error) {
        if (disposed) return;
        if (isContentCommentsAccessError(error)) {
          await loseAccess();

          return;
        }
        keys.forEach(key => failed.add(key));
        applyRemovals(keys);
        setSnapshot({ refreshError: true });
      }
    })();
    keys.forEach(key => inFlight.set(key, task));
    try {
      await task;
    } finally {
      active--;
      keys.forEach(key => {
        if (inFlight.get(key) === task) inFlight.delete(key);
      });
      if (dirty.size > 0) coalescer.schedule();
    }
  };

  const pump = (): void => {
    if (disposed || isFetching()) return;
    while (active < maxRequests) {
      const batch = [...dirty]
        .filter(key => !inFlight.has(key))
        .slice(0, CONTENT_THREAD_BRANCHES_MAX);
      if (batch.length === 0) return;
      batch.forEach(key => dirty.delete(key));
      void request(batch);
    }
  };

  const coalescer = createCoalescer({
    debounceMs,
    maxWaitMs,
    run: async () => {
      await idle();
      pump();
    },
  });

  const markDirty = (id: ContentId): void => {
    const key = keyOf(id);
    ids.set(key, id as TId);
    dirty.add(key);
  };

  const runReconcile = async (): Promise<void> => {
    // The refetch below reads every loaded branch, so nothing queued before
    // it needs its own request; signals that land during it queue again.
    dirty.clear();
    await queryClient.refetchQueries({
      exact: true,
      queryKey: threadKey,
      type: "active",
    });
    const state = query()?.state;
    if (state?.status === "error") {
      if (isContentCommentsAccessError(state.error)) {
        await loseAccess();
      } else {
        applyRemovals([...removals.keys()]);
        setSnapshot({ refreshError: true });
      }

      return;
    }
    removals.clear();
    failed.clear();
    const loaded = loadedBranches(data());
    for (const key of newBranches) if (loaded.has(key)) newBranches.delete(key);
    setSnapshot({ hasNew: newBranches.size > 0, refreshError: false });
  };

  let reconciling: null | Promise<void> = null;

  /** One re-read of the loaded pages at a time; callers meanwhile share it. */
  const reconcileNow = async (): Promise<void> => {
    // Nothing loaded - or access was just lost and the reset reads again.
    if (disposed || !data()) return;
    reconciling ??= runReconcile().finally(() => {
      reconciling = null;
    });
    await reconciling;
  };

  const showNew = async (attempt = 0): Promise<boolean> => {
    await idle();
    const current = data();
    if (!current || disposed) return false;
    const after = tailCursor(current);
    const startedIn = epoch;

    let tail: ContentCommentsThreadPage<TRecord, TId>;
    try {
      tail = await source.readPage(after);
    } catch (error) {
      if (isContentCommentsAccessError(error)) await loseAccess();

      return false;
    }
    await idle();
    if (disposed) return false;
    if (startedIn !== epoch) {
      return attempt < 1 ? await showNew(attempt + 1) : false;
    }

    beforeChange();
    queryClient.setQueryData<Data>(threadKey, old =>
      old ? appendContentCommentsTail(old, tail, tailCursor(old)) : old,
    );
    refreshPermissions(new Set(tail.items.map(item => keyOf(item.id))));

    const loaded = loadedBranches(data());
    const missing = [...newBranches].filter(key => !loaded.has(key));
    newBranches.clear();
    setSnapshot({ hasNew: false });
    // Published long after it was written, so it sits among loaded ones.
    if (missing.length > 0) await reconcileNow();

    return true;
  };

  const onCacheEvent = (event: QueryCacheNotifyEvent): void => {
    if (event.type !== "updated" || event.query.queryHash !== threadHash) {
      return;
    }
    const { action } = event;
    if (action.type === "fetch" && !action.meta?.fetchMore) epoch++;
    if (
      (action.type === "success" || action.type === "error") &&
      event.query.state.fetchStatus === "idle"
    ) {
      idleWaiters.splice(0).forEach(resolve => resolve());
      if (dirty.size > 0) coalescer.schedule();
    }
  };

  return {
    /**
     * Starts following the thread query; the returned function stops it and
     * drops scheduled work. Can be called again after stopping.
     */
    attach: (): (() => void) => {
      disposed = false;
      const unsubscribe = queryClient.getQueryCache().subscribe(onCacheEvent);

      return () => {
        disposed = true;
        clearTimeout(reconcileTimer);
        coalescer.cancel();
        unsubscribe();
        idleWaiters.splice(0).forEach(resolve => resolve());
      };
    },
    getSnapshot: (): ContentCommentsLiveSnapshot => snapshot,
    /** Installs how it reads and what to call before it changes the thread. */
    setSource: (next: ContentCommentsLiveSource<TRecord, TId>): void => {
      source = next;
    },
    /** Re-reads the loaded pages - after a (re)join, a root change or a revoke. */
    reconcile: ({ jitter = false }: { jitter?: boolean } = {}): void => {
      clearTimeout(reconcileTimer);
      if (!jitter) {
        void reconcileNow();

        return;
      }
      reconcileTimer = setTimeout(
        () => void reconcileNow(),
        Math.random() * RECONNECT_JITTER_MS,
      );
    },
    /**
     * Re-reads the branches of these comments now - after the reader's own
     * write - and resolves once they are merged. With no ids, only the counts
     * are read.
     */
    refresh: async (commentIds: ContentId[]): Promise<void> => {
      const keys = [
        ...new Set(
          commentIds.flatMap(id => {
            const branch = branchOf(id);
            if (branch === null) return [];
            const node = findNode(branch);
            if (node) ids.set(branch, node.id);

            return [branch];
          }),
        ),
      ];
      keys.forEach(key => dirty.delete(key));
      await Promise.all(keys.map(async key => await inFlight.get(key)));
      await idle();
      if (!disposed) await request(keys);
    },
    /** Reads what follows the last loaded comment, after the reader's own post. */
    refreshTail: async (): Promise<boolean> => {
      const current = data();
      const last = current?.pages.at(-1);
      if (!current || !last) return false;
      if (last.pageInfo.hasNextPage) {
        await request([]);

        return true;
      }

      return await showNew();
    },
    /**
     * Asks again for every branch whose last refresh failed - or re-reads the
     * loaded pages when that is what failed - and resolves once it is done.
     */
    retry: async (): Promise<void> => {
      if (failed.size === 0) {
        await reconcileNow();

        return;
      }
      const keys = [...failed];
      failed.clear();
      keys.forEach(key => dirty.delete(key));
      await idle();
      for (
        let start = 0;
        start < keys.length;
        start += CONTENT_THREAD_BRANCHES_MAX
      ) {
        if (disposed) return;
        await request(keys.slice(start, start + CONTENT_THREAD_BRANCHES_MAX));
      }
    },
    /** One signal from the thread's live room. */
    signal: (signal: ContentRefreshSignal): void => {
      if (disposed) return;
      if (signal.kind === "thread") {
        void reconcileNow();

        return;
      }
      if (signal.kind !== "branch") return;

      const key = keyOf(signal.branchId);
      const current = data();
      if (loadedBranches(current).has(key)) {
        if (signal.removedId !== undefined) {
          const removed = removals.get(key) ?? new Set<string>();
          removed.add(keyOf(signal.removedId));
          removals.set(key, removed);
        }
        markDirty(signal.branchId);
        coalescer.schedule();

        return;
      }
      // Not on screen: "Load more" reads it fresh when it is reached, and at
      // the end of the thread the reader decides when to show it.
      if (current && current.pages.at(-1)?.pageInfo.hasNextPage === false) {
        newBranches.add(key);
        setSnapshot({ hasNew: true });
      }
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    /**
     * Marks a comment with an open edit or reply form: if a refresh removes
     * it, it stays on screen as `removed` with its text until the form
     * closes, and is refreshed then.
     */
    trackDraft: (id: ContentId, open: boolean): void => {
      const key = keyOf(id);
      const count = (drafts.get(key) ?? 0) + (open ? 1 : -1);
      if (count > 0) {
        drafts.set(key, count);

        return;
      }
      drafts.delete(key);
      const node = findNode(key);
      if (node?.removed && node.record !== null) {
        const branch = branchOf(node.id);
        if (branch !== null) {
          const top = findNode(branch);
          if (top) markDirty(top.id);
          coalescer.flush();
        }
      }
    },
    /** Shows the comments that appeared at the end of the thread. */
    showNew: async (): Promise<boolean> => await showNew(),
  };
};

export type ContentCommentsLive<TRecord, TId extends ContentId> = ReturnType<
  typeof createContentCommentsLive<TRecord, TId>
>;
