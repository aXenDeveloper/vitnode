import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { RichTextDocument } from "@/content/rich-text";

import type { AuthUser } from "../auth/state";
import type { ContentCommentNode, ContentCommentsThreadPage } from "./thread";
import type {
  ContentCommentsApiResponse,
  ContentCommentsConfig,
} from "./use-content-comments";

import { sessionQueryOptions } from "../auth/session-query";
import { useContentComments } from "./use-content-comments";

interface CommentRecord {
  text: string;
}

const respond = (status: number, body: unknown = null) => ({
  json: async () => await Promise.resolve(body),
  ok: status >= 200 && status < 300,
  status,
});

type ThreadResponse =
  | {
      json: () => Promise<ContentCommentsThreadPage<CommentRecord, number>>;
      ok: true;
      status: 200;
    }
  | { json: () => Promise<unknown>; ok: false; status: number };

const comment = (
  id: number,
  parentId: null | number = null,
  overrides: Partial<ContentCommentNode<CommentRecord, number>> = {},
): ContentCommentNode<CommentRecord, number> => ({
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

const PAGES: Record<
  string,
  ContentCommentsThreadPage<CommentRecord, number>
> = {
  first: {
    items: [comment(1), comment(2, 1)],
    pageInfo: { endCursor: "cursor-1", hasNextPage: true, totalCount: 2 },
    replyCount: 3,
    truncated: false,
  },
  "cursor-1": {
    items: [comment(3)],
    pageInfo: { endCursor: null, hasNextPage: false, totalCount: 2 },
    replyCount: 3,
    truncated: true,
  },
};

const user: AuthUser = {
  avatarColor: "#101010",
  avatarUrl: null,
  birthday: null,
  coverUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "test@test.com",
  emailVerified: true,
  firstName: null,
  headline: null,
  hideOnlineStatus: false,
  id: 7,
  isAdmin: false,
  isModerator: false,
  lastName: null,
  name: "Test",
  nameCode: "test",
  newsletter: false,
  notifications: { revision: 0, unread: 0 },
  phone: null,
  roleId: 1,
  showRealName: false,
  timeZone: null,
};

const doc = (text: string): RichTextDocument => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

const threadFn = () =>
  vi.fn(
    async ({ after }: { after: null | string; first: number }) =>
      await Promise.resolve(
        respond(200, PAGES[after ?? "first"]) as ThreadResponse,
      ),
  );

const mount = <TRecord = CommentRecord,>(
  config: Partial<
    Omit<ContentCommentsConfig<ThreadResponse, TRecord>, "thread">
  > = {},
  { signedIn = true } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(sessionQueryOptions().queryKey, {
    user: signedIn ? user : null,
  });
  const thread = threadFn();

  const hook = renderHook(
    () =>
      useContentComments<ThreadResponse, TRecord>({
        queryKey: ["comments", 1],
        ...config,
        thread,
      }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );

  return { ...hook, thread };
};

const mountLoaded = async (
  ...args: Parameters<typeof mount<CommentRecord>>
) => {
  const mounted = mount<CommentRecord>(...args);
  await waitFor(() => {
    expect(mounted.result.current.status).toBe("success");
  });

  return mounted;
};

const NONE = {
  canDelete: false,
  canEdit: false,
  canHide: false,
  canReport: false,
};

type Comments = ReturnType<
  typeof useContentComments<ThreadResponse, CommentRecord>
>;

describe("useContentComments", () => {
  it("flattens the loaded pages into items and a tree, and loads the next cursor", async () => {
    const { result, thread } = await mountLoaded({ pageSize: 5 });

    expect(result.current.items.map(item => item.id)).toStrictEqual([1, 2]);
    expect(result.current.tree).toHaveLength(1);
    expect(result.current.tree[0].children.map(child => child.id)).toEqual([2]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.truncated).toBe(false);

    let loaded = false;
    await act(async () => {
      loaded = await result.current.loadMore();
    });

    expect(loaded).toBe(true);
    expect(thread.mock.calls.map(([page]) => page)).toStrictEqual([
      { after: null, first: 5 },
      { after: "cursor-1", first: 5 },
    ]);
    await waitFor(() => {
      expect(result.current.items.map(item => item.id)).toStrictEqual([
        1, 2, 3,
      ]);
    });
    expect(result.current.tree.map(node => node.id)).toStrictEqual([1, 3]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.truncated).toBe(true);
    expect(result.current.replyCount).toBe(3);
  });

  it("parses every loaded record with `record`", async () => {
    const { result } = mount({
      record: z
        .object({ text: z.string() })
        .transform(({ text }) => ({ text: text.toUpperCase() })),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(result.current.items.map(item => item.record)).toStrictEqual([
      { text: "COMMENT 1" },
      { text: "COMMENT 2" },
    ]);
  });

  it("reads permissions as all false until the server answers", async () => {
    let answer: (() => void) | undefined;
    const permissions = vi.fn(
      async (ids: number[]) =>
        await new Promise<ContentCommentsApiResponse>(resolve => {
          answer = () => {
            resolve(
              respond(200, {
                items: ids.map(id => ({ ...NONE, canEdit: true, id })),
              }),
            );
          };
        }),
    );
    const { result } = await mountLoaded({ permissions });

    await waitFor(() => {
      expect(permissions).toHaveBeenCalledWith([1, 2]);
    });
    expect(result.current.permissionsOf(1)).toStrictEqual(NONE);

    act(() => {
      answer?.();
    });

    await waitFor(() => {
      expect(result.current.permissionsOf(1)).toStrictEqual({
        ...NONE,
        canEdit: true,
      });
    });
  });

  it("reads permissions as all false when the server refuses them", async () => {
    const permissions = vi.fn(
      async (ids: number[]) =>
        await Promise.resolve(
          respond(403, {
            items: ids.map(id => ({ ...NONE, canEdit: true, id })),
          }),
        ),
    );
    const { result } = await mountLoaded({ permissions });

    await waitFor(() => {
      expect(permissions).toHaveBeenCalled();
    });
    await act(async () => {
      await new Promise(resolve => {
        setTimeout(resolve, 0);
      });
    });
    expect(result.current.permissionsOf(1)).toStrictEqual(NONE);
    expect(result.current.permissionsOf(2)).toStrictEqual(NONE);
  });

  const actions = [
    {
      name: "remove",
      run: (comments: Comments) => comments.remove(1),
    },
    {
      name: "hide",
      run: (comments: Comments) => comments.hide(1, "spam"),
    },
    {
      name: "unhide",
      run: (comments: Comments) => comments.unhide(1),
    },
  ];

  const wire = (request: () => Promise<ContentCommentsApiResponse>) => {
    const callback = vi.fn(request);

    return {
      callback,
      config: {
        delete: callback,
        visibility: { hide: callback, unhide: callback },
      } satisfies Partial<ContentCommentsConfig<ThreadResponse>>,
    };
  };

  it.each(actions)(
    "$name reports a refused answer without refreshing the thread",
    async ({ run }) => {
      const { callback, config } = wire(
        async () => await Promise.resolve(respond(403)),
      );
      const { result, thread } = await mountLoaded(config);

      let outcome: unknown;
      await act(async () => {
        outcome = await run(result.current);
      });

      expect(outcome).toStrictEqual({ ok: false, status: 403 });
      expect(callback).toHaveBeenCalledOnce();
      expect(thread).toHaveBeenCalledOnce();
      expect(result.current.busy).toBeNull();
    },
  );

  it.each(actions)(
    "$name refreshes the thread after the server accepts it",
    async ({ run }) => {
      const onChanged = vi.fn();
      const { callback, config } = wire(
        async () => await Promise.resolve(respond(200)),
      );
      const { result, thread } = await mountLoaded({ ...config, onChanged });

      let outcome: unknown;
      await act(async () => {
        outcome = await run(result.current);
      });

      expect(outcome).toStrictEqual({ ok: true });
      expect(callback).toHaveBeenCalledOnce();
      expect(thread).toHaveBeenCalledTimes(2);
      expect(onChanged).toHaveBeenCalledOnce();
    },
  );

  it("keeps the loaded comments and reports refreshError when a background refetch fails", async () => {
    const { result, thread } = await mountLoaded();
    thread.mockResolvedValue(respond(500) as ThreadResponse);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.refreshError).toBe(true);
    });
    expect(result.current.status).toBe("success");
    expect(result.current.items.map(item => item.id)).toStrictEqual([1, 2]);
  });

  it("is loading more, not refreshing, while the next page loads", async () => {
    const { result, thread } = await mountLoaded();
    let answer: () => void = () => undefined;
    thread.mockImplementationOnce(
      async () =>
        await new Promise<ThreadResponse>(resolve => {
          answer = () => {
            resolve(respond(200, PAGES["cursor-1"]) as ThreadResponse);
          };
        }),
    );

    let loading: Promise<boolean> = Promise.resolve(true);
    act(() => {
      loading = result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(true);
    });
    expect(result.current.isRefreshing).toBe(false);

    await act(async () => {
      answer();
      await loading;
    });
  });

  it.each([
    {
      name: "a delete",
      run: async (comments: Comments) => await comments.remove(2),
    },
    {
      name: "an edit",
      run: async (comments: Comments) => {
        await comments.requestSave(2, {
          body: doc("edited"),
          expectedVersion: undefined,
        });
        await comments.written({ approval: null, status: "published" });
      },
    },
  ])(
    "re-reads only the touched branch after $name when `branches` is wired",
    async ({ run }) => {
      const branches = vi.fn(
        async (ids: number[]) =>
          await Promise.resolve(
            respond(200, {
              branches: ids.map(id => ({
                id,
                items: [comment(1), comment(2, 1, { record: { text: "new" } })],
                status: "ok",
              })),
              pageInfo: { totalCount: 2 },
              replyCount: 3,
              truncated: false,
            }),
          ),
      );
      const save = vi.fn(async () => await Promise.resolve(respond(200)));
      const { result, thread } = await mountLoaded({
        branches,
        delete: save,
        edit: { load: vi.fn(), save },
      });

      await act(async () => {
        await run(result.current);
      });

      await waitFor(() => {
        expect(result.current.items[1].record).toStrictEqual({ text: "new" });
      });
      expect(save).toHaveBeenCalledOnce();
      expect(branches).toHaveBeenCalledExactlyOnceWith([1]);
      expect(thread).toHaveBeenCalledOnce();
    },
  );

  it("refuses a second action while one runs, without calling it", async () => {
    let settle: (() => void) | undefined;
    const remove = vi.fn(
      async () =>
        await new Promise<ContentCommentsApiResponse>(resolve => {
          settle = () => {
            resolve(respond(200));
          };
        }),
    );
    const hide = vi.fn(async () => await Promise.resolve(respond(200)));
    const unhide = vi.fn(async () => await Promise.resolve(respond(200)));
    const { result } = await mountLoaded({
      delete: remove,
      visibility: { hide, unhide },
    });

    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = result.current.remove(1);
      second = await result.current.hide(2, null);
    });

    expect(second).toStrictEqual({ ok: false, status: 409 });
    expect(hide).not.toHaveBeenCalled();
    expect(result.current.busy).toStrictEqual({ action: "delete", id: 1 });

    await act(async () => {
      settle?.();
      await first;
    });

    expect(await first).toStrictEqual({ ok: true });
    expect(result.current.busy).toBeNull();
  });

  it.each([
    [{ approval: { status: "pending" }, status: "draft" }, "pending"],
    [{ approval: null, status: "published" }, "published"],
    [{ approval: null, status: "draft" }, "draft"],
    [{ id: 1 }, "draft"],
    [null, "draft"],
  ])("reads the written record %j as %s", async (record, expected) => {
    const { result } = await mountLoaded();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.written(record);
    });

    expect(outcome).toBe(expected);
  });

  it.each([
    {
      approval: {
        kind: "edit",
        status: "pending",
        values: { body: doc("proposed") },
      },
      expected: { body: doc("proposed"), proposed: true, version: 4 },
      name: "a pending edit proposal",
    },
    {
      approval: {
        kind: "create",
        status: "pending",
        values: { body: doc("proposed") },
      },
      expected: { body: doc("public"), proposed: false, version: 4 },
      name: "the public text beside a pending create",
    },
    {
      approval: null,
      expected: { body: doc("public"), proposed: false, version: 4 },
      name: "the public text without a proposal",
    },
  ])("loadEditable opens on $name", async ({ approval, expected }) => {
    const load = vi.fn(
      async () =>
        await Promise.resolve(
          respond(200, {
            approval,
            values: { body: doc("public") },
            version: 4,
          }),
        ),
    );
    const { result } = await mountLoaded({
      edit: { load, save: vi.fn() },
    });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.loadEditable(1);
    });

    expect(load).toHaveBeenCalledWith(1);
    expect(outcome).toStrictEqual({ ok: true, value: expected });
  });

  const create = vi.fn();

  it.each([
    {
      canReply: true,
      config: { create, maxDepth: 3 },
      depth: 2,
      hidden: false,
    },
    {
      canReply: false,
      config: { create, maxDepth: 2 },
      depth: 2,
      hidden: false,
    },
    {
      canReply: false,
      config: { create, maxDepth: 3 },
      depth: 1,
      hidden: true,
    },
    { canReply: false, config: { maxDepth: 3 }, depth: 1, hidden: false },
    { canReply: false, config: { create }, depth: 1, hidden: false },
    {
      canReply: false,
      config: { create, maxDepth: 3 },
      depth: 1,
      hidden: false,
      signedIn: false,
    },
  ])(
    "canReply is $canReply at depth $depth (hidden: $hidden, signed in: $signedIn) with %o",
    async ({ canReply, config, depth, hidden, signedIn = true }) => {
      const { result } = await mountLoaded(config, { signedIn });

      expect(result.current.canReply(comment(1, null, { depth, hidden }))).toBe(
        canReply,
      );
    },
  );
});
