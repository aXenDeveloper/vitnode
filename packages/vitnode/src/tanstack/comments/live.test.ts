import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentCommentsData } from "./live";
import type {
  ContentCommentNode,
  ContentCommentsBranches,
  ContentCommentsThreadPage,
} from "./thread";

import {
  appendContentCommentsTail,
  ContentCommentsRequestError,
  createContentCommentsLive,
  mergeContentCommentBranches,
} from "./live";

interface Rec {
  text: string;
}

type Node = ContentCommentNode<Rec, number>;
type Page = ContentCommentsThreadPage<Rec, number>;
type Data = ContentCommentsData<Rec, number>;

const node = (
  id: number,
  parentId: null | number = null,
  overrides: Partial<Node> = {},
): Node => ({
  deleted: null,
  depth: parentId === null ? 1 : 2,
  hidden: false,
  hiddenReason: null,
  id,
  parentId,
  record: { text: `comment ${id}` },
  removed: false,
  ...overrides,
});

const page = (
  items: Node[],
  endCursor: null | string,
  hasNextPage = false,
): Page => ({
  items,
  pageInfo: { endCursor, hasNextPage, totalCount: 3 },
  replyCount: 5,
  truncated: false,
});

const ids = (items: Node[]) => items.map(item => item.id);

const answer = (
  branches: ContentCommentsBranches<Rec, number>["branches"],
  truncated = false,
): ContentCommentsBranches<Rec, number> => ({
  branches,
  pageInfo: { totalCount: 9 },
  replyCount: 20,
  truncated,
});

describe("mergeContentCommentBranches", () => {
  const data = (): Data => ({
    pageParams: [null, "c1"],
    pages: [
      page([node(1), node(2, 1), node(3)], "c1", true),
      page([node(4), node(5, 4)], "c2"),
    ],
  });

  it("replaces a branch in place and keeps every other page and page param", () => {
    const before = data();

    const merged = mergeContentCommentBranches(
      before,
      answer([{ id: 1, items: [node(1), node(6, 1)], status: "ok" }], true),
    );

    expect(ids(merged.pages[0].items)).toStrictEqual([1, 6, 3]);
    expect(merged.pages[0].items[2]).toBe(before.pages[0].items[2]);
    expect(merged.pages[1].items).toBe(before.pages[1].items);
    expect(merged.pageParams).toBe(before.pageParams);
    expect(merged.pages.map(item => item.pageInfo)).toStrictEqual([
      { endCursor: "c1", hasNextPage: true, totalCount: 9 },
      { endCursor: "c2", hasNextPage: false, totalCount: 9 },
    ]);
    expect(merged.pages.map(item => item.replyCount)).toStrictEqual([20, 20]);
    expect(merged.pages.map(item => item.truncated)).toStrictEqual([
      true,
      false,
    ]);
  });

  it("drops a gone branch with its replies", () => {
    const merged = mergeContentCommentBranches(
      data(),
      answer([{ id: 4, status: "gone" }]),
    );

    expect(ids(merged.pages[1].items)).toStrictEqual([]);
    expect(ids(merged.pages[0].items)).toStrictEqual([1, 2, 3]);
  });

  it("leaves a branch alone when skip says a newer answer replaced it", () => {
    const before = data();

    const merged = mergeContentCommentBranches(
      before,
      answer([{ id: 1, status: "gone" }]),
      { skip: key => key === "1" },
    );

    expect(merged.pages[0].items).toBe(before.pages[0].items);
  });

  it("keeps a comment with an open editor as removed, with its text", () => {
    const merged = mergeContentCommentBranches(
      data(),
      answer([{ id: 1, items: [node(1)], status: "ok" }]),
      { drafts: new Set(["2"]) },
    );

    expect(
      merged.pages[0].items.map(({ id, record, removed }) => ({
        id,
        record,
        removed,
      })),
    ).toStrictEqual([
      { id: 1, record: { text: "comment 1" }, removed: false },
      { id: 2, record: { text: "comment 2" }, removed: true },
      { id: 3, record: { text: "comment 3" }, removed: false },
    ]);
  });
});

describe("appendContentCommentsTail", () => {
  const data = (): Data => ({
    pageParams: [null],
    pages: [page([node(1), node(2, 1)], "c1")],
  });

  it("appends the comments after the last loaded one, without branches already on screen", () => {
    const before = data();

    const appended = appendContentCommentsTail(
      before,
      page([node(1), node(7), node(8, 7)], "c2"),
      "c1",
    );

    expect(appended.pageParams).toStrictEqual([null, "c1"]);
    expect(appended.pages[0].items).toBe(before.pages[0].items);
    expect(ids(appended.pages[1].items)).toStrictEqual([7, 8]);
  });

  it("replaces an empty thread's only page", () => {
    const tail = page([node(7)], "c1");

    expect(
      appendContentCommentsTail(
        { pageParams: [null], pages: [page([], null)] },
        tail,
        null,
      ),
    ).toStrictEqual({ pageParams: [null], pages: [tail] });
  });

  it("only updates the counts when nothing new is left", () => {
    const appended = appendContentCommentsTail(
      data(),
      { ...page([node(1)], "c2"), replyCount: 8 },
      "c1",
    );

    expect(appended.pages).toHaveLength(1);
    expect(appended.pages[0].replyCount).toBe(8);
  });
});

/**
 * A thread on a fake server: top-level comment `k * 10` with one reply
 * `k * 10 + 1` below it, `PAGE_SIZE` top-level comments per page.
 */
const PAGE_SIZE = 2;

const branchOf = (k: number): Node[] => [
  node(k * 10),
  node(k * 10 + 1, k * 10),
];

const createServer = (count: number) => {
  const state = {
    branches: Array.from({ length: count }, (_, index) => branchOf(index + 1)),
    denied: null as null | number,
  };
  const refuse = () => {
    if (state.denied !== null) {
      throw new ContentCommentsRequestError(state.denied, "Refused.");
    }
  };
  const counts = () => ({
    replyCount: state.branches.flat().length,
    totalCount: state.branches.length,
  });

  return {
    branches: (requested: number[]): ContentCommentsBranches<Rec, number> => {
      refuse();
      const { replyCount, totalCount } = counts();

      return structuredClone({
        branches: requested.map(id => {
          const found = state.branches.find(branch => branch[0].id === id);

          return found
            ? { id, items: found, status: "ok" as const }
            : { id, status: "gone" as const };
        }),
        pageInfo: { totalCount },
        replyCount,
        truncated: false,
      });
    },
    page: (after: null | string): Page => {
      refuse();
      const start = after === null ? 0 : Number(after.slice(1));
      const tops = state.branches.slice(start, start + PAGE_SIZE);
      const end = start + tops.length;
      const { replyCount, totalCount } = counts();

      return structuredClone({
        items: tops.flat(),
        pageInfo: {
          endCursor: tops.length > 0 ? `c${end}` : null,
          hasNextPage: end < state.branches.length,
          totalCount,
        },
        replyCount,
        truncated: false,
      });
    },
    state,
  };
};

const THREAD_KEY = ["comments", 1, "thread"];

const cleanups: (() => void)[] = [];

const setup = async ({
  branches,
  loadedPages,
  maxRequests,
}: {
  branches: number;
  loadedPages: number;
  maxRequests?: number;
}) => {
  const server = createServer(branches);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false, staleTime: Infinity },
    },
  });
  // `GET /thread` as the infinite query reads it.
  const threadReads = vi.fn(async (after: null | string) => {
    await Promise.resolve();

    return server.page(after);
  });
  const options = {
    getNextPageParam: (last: Page) =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }: { pageParam: null | string }) =>
      await threadReads(pageParam),
    queryKey: THREAD_KEY,
  };
  await queryClient.infiniteQuery({ ...options, pages: loadedPages });
  const observer = new InfiniteQueryObserver(queryClient, options);
  const stopObserving = observer.subscribe(() => undefined);

  const live = createContentCommentsLive<Rec, number>({
    maxRequests,
    permissionsKey: ["comments", 1, "permissions"],
    queryClient,
    threadKey: THREAD_KEY,
  });
  // `GET /thread/branches` and `GET /thread` as the live controller reads them.
  const readBranches = vi.fn(async (requested: number[]) => {
    await Promise.resolve();

    return server.branches(requested);
  });
  const readPage = vi.fn(async (after: null | string) => {
    await Promise.resolve();

    return server.page(after);
  });
  live.setSource({ readBranches, readPage });
  const detach = live.attach();
  cleanups.push(() => {
    detach();
    stopObserving();
    queryClient.clear();
  });
  threadReads.mockClear();

  const data = () => queryClient.getQueryData<Data>(THREAD_KEY);
  const loadedIds = () => data()?.pages.flatMap(item => ids(item.items));
  const requests = () => ({
    readBranches: readBranches.mock.calls.length,
    readPage: readPage.mock.calls.length,
    threadReads: threadReads.mock.calls.length,
  });

  return {
    data,
    live,
    loadedIds,
    observer,
    readBranches,
    readPage,
    requests,
    server,
    threadReads,
  };
};

/** A promise the test settles by hand. */
const gate = <T>() => {
  let open: (value: T) => void = () => undefined;
  const promise = new Promise<T>(resolve => {
    open = resolve;
  });

  return { open, promise };
};

const SETTLE_MS = 5_000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.useRealTimers();
});

describe("createContentCommentsLive", () => {
  describe("request cost", () => {
    it.each([
      ["a new comment while more pages wait on the server", () => [node(90)]],
      [
        "a reply in a branch that is not loaded",
        () => [...branchOf(7), node(72, 70)],
      ],
    ])("%s: 0 requests", async (_label, change) => {
      const { live, requests, server } = await setup({
        branches: 8,
        loadedPages: 3,
      });
      const branch = change();
      const at = server.state.branches.findIndex(
        item => item[0].id === branch[0].id,
      );
      if (at === -1) server.state.branches.push(branch);
      else server.state.branches[at] = branch;

      live.signal({ branchId: branch[0].id, kind: "branch" });
      await vi.advanceTimersByTimeAsync(SETTLE_MS);

      expect(requests()).toStrictEqual({
        readBranches: 0,
        readPage: 0,
        threadReads: 0,
      });
      expect(live.getSnapshot().hasNew).toBe(false);
    });

    it("a new comment at the end of the thread: 0 requests, then 1 page read on showNew", async () => {
      const { data, live, readPage, requests, server } = await setup({
        branches: 6,
        loadedPages: 3,
      });
      server.state.branches.push([node(90)]);

      live.signal({ branchId: 90, kind: "branch" });
      await vi.advanceTimersByTimeAsync(SETTLE_MS);

      expect(requests()).toStrictEqual({
        readBranches: 0,
        readPage: 0,
        threadReads: 0,
      });
      expect(live.getSnapshot().hasNew).toBe(true);

      const before = data()?.pages.map(item => item.items) ?? [];
      const shown = await live.showNew();

      expect(shown).toBe(true);
      expect(requests()).toStrictEqual({
        readBranches: 0,
        readPage: 1,
        threadReads: 0,
      });
      expect(readPage).toHaveBeenCalledWith("c6");
      const after = data()?.pages ?? [];
      expect(after).toHaveLength(4);
      before.forEach((items, index) => {
        expect(after[index].items).toBe(items);
      });
      expect(ids(after[3].items)).toStrictEqual([90]);
      expect(live.getSnapshot().hasNew).toBe(false);
    });

    it("five quick signals for one loaded branch: 1 branch read", async () => {
      const { live, loadedIds, readBranches, requests, server } = await setup({
        branches: 6,
        loadedPages: 3,
      });
      server.state.branches[0] = [...branchOf(1), node(12, 10)];

      for (let signal = 0; signal < 5; signal++) {
        live.signal({ branchId: 10, kind: "branch" });
        await vi.advanceTimersByTimeAsync(100);
      }
      await vi.advanceTimersByTimeAsync(SETTLE_MS);

      expect(requests()).toStrictEqual({
        readBranches: 1,
        readPage: 0,
        threadReads: 0,
      });
      expect(readBranches).toHaveBeenCalledWith([10]);
      expect(loadedIds()?.slice(0, 3)).toStrictEqual([10, 11, 12]);
    });
  });

  it("holds a branch answer while the next page loads, and merges it after", async () => {
    const {
      data,
      live,
      loadedIds,
      observer,
      readBranches,
      server,
      threadReads,
    } = await setup({ branches: 4, loadedPages: 1 });
    const branchAnswer = gate<ContentCommentsBranches<Rec, number>>();
    readBranches.mockImplementationOnce(async () => await branchAnswer.promise);
    const nextPage = gate<Page>();
    threadReads.mockImplementationOnce(async () => await nextPage.promise);

    live.signal({ branchId: 10, kind: "branch" });
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    expect(readBranches).toHaveBeenCalledOnce();

    const loading = observer.fetchNextPage();
    await vi.advanceTimersByTimeAsync(0);
    server.state.branches[0] = [node(10, null, { record: { text: "new" } })];
    branchAnswer.open(server.branches([10]));
    await vi.advanceTimersByTimeAsync(0);

    expect(data()?.pages[0].items[0].record).toStrictEqual({
      text: "comment 10",
    });

    nextPage.open(server.page("c2"));
    await loading;
    await vi.advanceTimersByTimeAsync(0);

    expect(loadedIds()).toStrictEqual([10, 20, 21, 30, 31, 40, 41]);
    expect(data()?.pages[0].items[0].record).toStrictEqual({ text: "new" });
  });

  it("drops a branch answer that started before a full refetch, and asks again", async () => {
    const { data, live, readBranches, server, threadReads } = await setup({
      branches: 2,
      loadedPages: 1,
    });
    const stale = gate<ContentCommentsBranches<Rec, number>>();
    readBranches.mockImplementationOnce(async () => await stale.promise);

    live.signal({ branchId: 10, kind: "branch" });
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    expect(readBranches).toHaveBeenCalledOnce();

    const staleAnswer = server.branches([10]);
    server.state.branches[0] = [node(10, null, { record: { text: "fresh" } })];
    live.reconcile();
    await vi.advanceTimersByTimeAsync(0);
    stale.open(staleAnswer);
    await vi.advanceTimersByTimeAsync(SETTLE_MS);

    expect(threadReads).toHaveBeenCalledOnce();
    expect(readBranches).toHaveBeenCalledTimes(2);
    expect(data()?.pages[0].items[0].record).toStrictEqual({ text: "fresh" });
  });

  it("keeps the thread when a branch read fails, takes the removed comment off and retries", async () => {
    const { live, loadedIds, readBranches, server } = await setup({
      branches: 2,
      loadedPages: 1,
    });
    readBranches.mockRejectedValueOnce(
      new ContentCommentsRequestError(500, "Down."),
    );
    server.state.branches[0] = [node(10)];

    live.signal({ branchId: 10, kind: "branch", removedId: 11 });
    await vi.advanceTimersByTimeAsync(SETTLE_MS);

    expect(loadedIds()).toStrictEqual([10, 20, 21]);
    expect(live.getSnapshot().refreshError).toBe(true);

    const retried = live.retry();
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
    await retried;

    expect(readBranches).toHaveBeenCalledTimes(2);
    expect(loadedIds()).toStrictEqual([10, 20, 21]);
    expect(live.getSnapshot().refreshError).toBe(false);
  });

  it.each([401, 403, 404])(
    "drops the thread when a branch read answers %i",
    async status => {
      const { data, live, server } = await setup({
        branches: 2,
        loadedPages: 1,
      });
      server.state.denied = status;

      live.signal({ branchId: 10, kind: "branch" });
      await vi.advanceTimersByTimeAsync(SETTLE_MS);

      expect(data()).toBeUndefined();
    },
  );

  it("keeps a removed comment with an open editor until the editor closes", async () => {
    const { data, live, loadedIds, readBranches, server } = await setup({
      branches: 2,
      loadedPages: 1,
    });
    live.trackDraft(11, true);
    server.state.branches[0] = [node(10)];

    live.signal({ branchId: 10, kind: "branch", removedId: 11 });
    await vi.advanceTimersByTimeAsync(SETTLE_MS);

    expect(data()?.pages[0].items[1]).toMatchObject({
      id: 11,
      record: { text: "comment 11" },
      removed: true,
    });

    live.trackDraft(11, false);
    await vi.advanceTimersByTimeAsync(SETTLE_MS);

    expect(readBranches).toHaveBeenCalledTimes(2);
    expect(loadedIds()).toStrictEqual([10, 20, 21]);
  });

  it("sends at most maxRequests branch reads at once", async () => {
    const { live, readBranches, server } = await setup({
      branches: 30,
      loadedPages: 15,
      maxRequests: 2,
    });
    let running = 0;
    let most = 0;
    const waiting: (() => void)[] = [];
    readBranches.mockImplementation(async requested => {
      running++;
      most = Math.max(most, running);
      await new Promise<void>(resolve => {
        waiting.push(resolve);
      });
      running--;

      return server.branches(requested);
    });

    for (const branch of server.state.branches) {
      live.signal({ branchId: branch[0].id, kind: "branch" });
    }
    await vi.advanceTimersByTimeAsync(SETTLE_MS);

    expect(readBranches).toHaveBeenCalledTimes(2);

    while (waiting.length > 0) {
      waiting.splice(0).forEach(resolve => resolve());
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    }

    expect(most).toBe(2);
    expect(readBranches).toHaveBeenCalledTimes(3);
    expect(
      readBranches.mock.calls
        .flatMap(([requested]) => requested)
        .toSorted((a, b) => a - b),
    ).toStrictEqual(server.state.branches.map(branch => branch[0].id));
  });
});
