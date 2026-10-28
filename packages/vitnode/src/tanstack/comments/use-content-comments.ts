import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  hashKey,
  infiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React from "react";
import { z } from "zod";

import type { ContentId } from "@/content/ids";
import type { RichTextDocument } from "@/content/rich-text";
import type { ContentTarget } from "@/content/target";
import type { ContentLiveRefreshStatus } from "@/tanstack/content/live-refresh";

import { zodRichTextDocument } from "@/content/rich-text";

import type {
  ContentPermissions,
  ContentPermissionsResponse,
} from "../content/permissions";
import type { ContentCommentsLive } from "./live";
import type {
  ContentCommentNode,
  ContentCommentsBranches,
  ContentCommentsThreadPage,
  ContentCommentTreeNode,
  ContentCommentWriteOutcome,
} from "./thread";

import { useSessionQuery } from "../auth/session-query";
import { useContentLiveRefresh } from "../content/live-refresh";
import { useContentPermissions } from "../content/permissions";
import { ContentCommentsRequestError, createContentCommentsLive } from "./live";
import {
  buildContentCommentTree,
  CONTENT_COMMENT_ANCHOR_PREFIX,
  contentCommentWriteOutcome,
  shareContentCommentTree,
} from "./thread";

/** The response of a typed `fetcher` call, as the comments hook reads it. */
export interface ContentCommentsApiResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

/** What a typed response's `2xx` member resolves `json()` to. */
type OkBody<R> = R extends { json: () => Promise<infer T>; ok: true }
  ? T
  : never;

type NodeOf<R> = OkBody<R> extends { items: readonly (infer N)[] } ? N : never;

/** The comment record of a thread response, as the content type's public API serves it. */
export type ContentCommentRecordOf<R> = NonNullable<
  NodeOf<R> extends { record: infer T } ? T : never
>;

/** The id type of a thread response: `number`, or `string` for a uuid content type. */
export type ContentCommentIdOf<R> =
  NodeOf<R> extends { id: infer I extends ContentId } ? I : never;

/** Values a comment's edit form opens with, from `GET /{id}/edit`. */
export interface ContentCommentEditable {
  body: RichTextDocument;
  /**
   * `true` when the form opened on the author's edit that still waits for a
   * moderator, not on the public text.
   */
  proposed: boolean;
  /** The version to send as `expectedVersion`, with editorial revisions on. */
  version: number | undefined;
}

/** How an action that is not a form ended. */
export type ContentCommentActionResult =
  | { ok: false; status: number }
  | { ok: true };

/** An action running on one comment; other actions on it wait. */
export interface ContentCommentBusy<TId extends ContentId> {
  action: "delete" | "edit" | "hide" | "unhide";
  id: TId;
}

/**
 * Wires one comment thread to a content type's typed public API. Every
 * callback calls `fetcher` inline and returns its response as is, so plugin,
 * module, path, inputs and answers stay inferred from the plugin's routes.
 * Leave an action out and its button never shows.
 */
export interface ContentCommentsConfig<
  R extends ContentCommentsApiResponse,
  TRecord = ContentCommentRecordOf<R>,
> {
  /**
   * Whether the access rules of the commented record let this visitor reply -
   * the `canComment` flag a container, a category or `GET /permissions`
   * reported. `false` swaps the composer for a "no access" note and hides
   * **Reply**; the server checks again on every write. Defaults to `true`.
   */
  allowed?: boolean;
  /**
   * Re-reads a few top-level branches - `GET /thread/branches` with `root`
   * and `ids` joined by commas (left out when there are none). With it, a
   * write refreshes only the branch it touched instead of every loaded page,
   * and `live` can keep the thread current. Without it, a write re-reads
   * every loaded page.
   */
  branches?: (
    ids: ContentCommentIdOf<R>[],
  ) => Promise<ContentCommentsApiResponse>;
  /**
   * Opens a new top-level comment or a reply - `POST /` with the root record,
   * `body` and `parent: parentId`. Without it nobody can comment here.
   */
  create?: (input: {
    body: RichTextDocument;
    parentId: ContentCommentIdOf<R> | null;
  }) => Promise<ContentCommentsApiResponse>;
  /** Deletes one comment - `POST /{id}/delete`. Asks for confirmation first. */
  delete?: (id: ContentCommentIdOf<R>) => Promise<ContentCommentsApiResponse>;
  /** Edits the author's own comments, or any as a moderator. */
  edit?: {
    /** Reads the editable values - `GET /{id}/edit`. */
    load: (id: ContentCommentIdOf<R>) => Promise<ContentCommentsApiResponse>;
    /**
     * Saves - `PATCH /{id}`. Send `expectedVersion` when the content type has
     * editorial revisions; it is `undefined` without them, and the last save
     * wins.
     */
    save: (
      id: ContentCommentIdOf<R>,
      input: { body: RichTextDocument; expectedVersion: number | undefined },
    ) => Promise<ContentCommentsApiResponse>;
  };
  /**
   * The name of the rich-text field that holds the comment's text, in the
   * public record and in `GET /{id}/edit`'s `values`. Defaults to `"body"`.
   */
  field?: string;
  /**
   * Keeps the thread current while it is on screen, over the shared
   * WebSocket: changed branches are re-read with `branches` (required) and
   * merged in place, new comments at the end wait behind **Show new
   * comments**, and a reconnect re-reads the loaded pages. Leave it out for a
   * thread that only changes on reload.
   */
  live?: {
    /** The comment content type's id, e.g. `blogCommentContentType.id`. */
    contentTypeId: string;
    /** The root record the thread hangs off. */
    rootId: ContentId;
  };
  /**
   * The deepest level a reply may sit at - the content type's
   * `thread.maxDepth`. Leave it out for flat comments: **Reply** never shows.
   */
  maxDepth?: number;
  /**
   * Refreshes the plugin's own queries after a successful write, such as a
   * comment count elsewhere on the page. The thread and its permissions are
   * refreshed already.
   */
  onChanged?: (queryClient: QueryClient) => Promise<void> | void;
  /** Comments per page, 1-50. Defaults to 20. */
  pageSize?: number;
  /**
   * Asks what the visitor may do with the comments on screen -
   * `GET /permissions` with `ids` joined by commas. Without it every comment
   * reads as "no actions".
   */
  permissions?: (
    ids: ContentCommentIdOf<R>[],
  ) => Promise<ContentCommentsApiResponse>;
  /**
   * The thread's query key prefix, unique per root record, e.g.
   * `[manifest.id, "comments", article.id]`. The thread is cached under
   * `[...queryKey, "thread"]` and the permissions under
   * `[...queryKey, "permissions", ...]`.
   */
  queryKey: QueryKey;
  /**
   * Validates each loaded comment's public record, for custom rendering that
   * reads its fields: the thread route types records loosely, so this is
   * what gives `TRecord` its shape. A record that does not match fails the
   * page like a refused request. Leave it out for the default rendering.
   */
  record?: z.ZodType<TRecord>;
  /**
   * The reported record for **Report** - `contentTarget(manifest.id,
   * commentContentType, id)` from `@vitnode/core/content`. Shows only where
   * the server answers `canReport`.
   */
  report?: (id: ContentCommentIdOf<R>) => ContentTarget;
  /** Reads one page - `GET /thread` with `root`, `first` and `after`. */
  thread: (page: { after: null | string; first: number }) => Promise<R>;
  /** Hides and shows comments again - `POST /{id}/hide` and `/unhide`. */
  visibility?: {
    hide: (
      id: ContentCommentIdOf<R>,
      input: { reason: null | string },
    ) => Promise<ContentCommentsApiResponse>;
    unhide: (id: ContentCommentIdOf<R>) => Promise<ContentCommentsApiResponse>;
  };
}

const DEFAULT_PAGE_SIZE = 20;

type WriteTarget<TId> = { id: TId } | { parentId: null | TId };

const noopSubscribe = () => () => undefined;

const EMPTY_LIVE_SNAPSHOT = { hasNew: false, refreshError: false };

const emptySnapshot = () => EMPTY_LIVE_SNAPSHOT;

const zodWrittenRecord = z.object({
  approval: z.object({ status: z.string() }).nullable(),
  status: z.string(),
});

/**
 * The thread's infinite query, for warming the first page in a route's
 * `loader` with `queryClient.infiniteQuery(...)`, so the comments arrive with
 * the page's HTML. `useContentComments` reads the same cache entry.
 * Universal.
 *
 * @throws A `ContentCommentsRequestError` from `queryFn`, carrying the
 * `status`, when the thread route answers anything but `2xx`.
 */
export const contentCommentsQueryOptions = <
  R extends ContentCommentsApiResponse,
  TRecord = ContentCommentRecordOf<R>,
>({
  pageSize = DEFAULT_PAGE_SIZE,
  queryKey,
  record,
  thread,
}: Pick<
  ContentCommentsConfig<R, TRecord>,
  "pageSize" | "queryKey" | "record" | "thread"
>) =>
  infiniteQueryOptions({
    getNextPageParam: (
      last: ContentCommentsThreadPage<TRecord, ContentCommentIdOf<R>>,
    ) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }) =>
      await readContentCommentsPage({
        after: pageParam,
        first: pageSize,
        record,
        thread,
      }),
    queryKey: [...queryKey, "thread"],
  });

/** Validates each record of thread nodes with `record`, when given. */
const parseNodes = <TRecord, TId extends ContentId>(
  items: ContentCommentNode<TRecord, TId>[],
  record: undefined | z.ZodType<TRecord>,
): ContentCommentNode<TRecord, TId>[] =>
  record
    ? items.map(item => ({
        ...item,
        record: item.record === null ? null : record.parse(item.record),
      }))
    : items;

const readContentCommentsPage = async <
  R extends ContentCommentsApiResponse,
  TRecord,
>({
  after,
  first,
  record,
  thread,
}: Pick<ContentCommentsConfig<R, TRecord>, "record" | "thread"> & {
  after: null | string;
  first: number;
}): Promise<ContentCommentsThreadPage<TRecord, ContentCommentIdOf<R>>> => {
  const res = await thread({ after, first });
  if (!res.ok) {
    throw new ContentCommentsRequestError(
      res.status,
      `Loading the comments answered ${res.status}.`,
    );
  }

  // The typed response's `2xx` member is the thread route's answer, and
  // without `record` its records keep the type the route gives them.
  const page = (await res.json()) as ContentCommentsThreadPage<
    TRecord,
    ContentCommentIdOf<R>
  >;

  return { ...page, items: parseNodes(page.items, record) };
};

const readEditable = (
  body: unknown,
  field: string,
): ContentCommentEditable | null => {
  if (typeof body !== "object" || body === null) return null;
  const { approval, values, version } = body as {
    approval?: null | { kind?: unknown; status?: unknown; values?: unknown };
    values?: Record<string, unknown>;
    version?: unknown;
  };
  const proposal =
    approval?.status === "pending" &&
    approval.kind === "edit" &&
    typeof approval.values === "object" &&
    approval.values !== null
      ? zodRichTextDocument.safeParse(
          (approval.values as Record<string, unknown>)[field],
        )
      : null;
  const current = zodRichTextDocument.safeParse(values?.[field]);
  const text = proposal?.success ? proposal.data : current.data;
  if (!text) return null;

  return {
    body: text,
    proposed: proposal?.success === true,
    version: typeof version === "number" ? version : undefined,
  };
};

/**
 * The state and actions of one comment thread, as `useContentComments`
 * returns them and every shared comments component reads them.
 */
export interface ContentCommentsController<
  TRecord = unknown,
  TId extends ContentId = ContentId,
> {
  /** The action running right now, or `null`. Other actions wait for it. */
  busy: ContentCommentBusy<TId> | null;
  /** Whether the visitor may write a new comment here: signed in, with `create` given and `allowed`. */
  canComment: boolean;
  /** Whether **Reply** shows under `node`: replies allowed, under `maxDepth`, not hidden or removed. */
  canReply: (node: ContentCommentNode<TRecord, TId>) => boolean;
  /** Whether a signed-in visitor is kept from commenting by access rules. */
  commentLocked: boolean;
  /** Which actions the plugin wired up. A button also needs the server's `can*` answer. */
  features: {
    create: boolean;
    delete: boolean;
    edit: boolean;
    hide: boolean;
    replies: boolean;
    report: boolean;
  };
  /** The rich-text field that holds a comment's text. */
  field: string;
  /** Whether more top-level comments wait on the server. */
  hasMore: boolean;
  /**
   * Live only: comments appeared after the last loaded one, at the end of the
   * thread. They stay off screen until `showNewComments()`.
   */
  hasNewComments: boolean;
  /** Hides one comment, with an optional reason of at most 500 characters. */
  hide: (id: TId, reason: null | string) => Promise<ContentCommentActionResult>;
  /** `true` while the next page loads. */
  isLoadingMore: boolean;
  /** `true` while comments already on screen are read again - not while loading more. */
  isRefreshing: boolean;
  /** `true` while the session is unknown, so the composer can wait for it. */
  isSessionPending: boolean;
  /** Every loaded entry, flat and depth first. */
  items: ContentCommentNode<TRecord, TId>[];
  /** Where the live subscription stands; `off` without `live`. */
  liveStatus: ContentLiveRefreshStatus;
  /** Reads what an edit form opens with: the public text, or the author's pending proposal. */
  loadEditable: (
    id: TId,
  ) => Promise<
    { ok: false; status: number } | { ok: true; value: ContentCommentEditable }
  >;
  /** Loads the next page; resolves to `false` when it failed. */
  loadMore: () => Promise<boolean>;
  /** The visitor's permissions for one comment, all `false` until known or after a failure. */
  permissionsOf: (id: TId) => ContentPermissions;
  /** Re-reads every loaded page, its permissions and `onChanged`'s queries. */
  refresh: () => Promise<void>;
  /**
   * A background read of comments already on screen failed. They stay, as
   * they were; `retryRefresh()` asks again.
   */
  refreshError: boolean;
  /** Deletes one comment. One with replies stays as an anonymous placeholder. */
  remove: (id: TId) => Promise<ContentCommentActionResult>;
  /** Every public comment in the thread, at any depth. */
  replyCount: number;
  /** The reported target of one comment, or `null` without `report`. */
  reportTarget: (id: TId) => ContentTarget | null;
  /** Sends a new comment or a reply, as `useContentPublicWrite`'s `submit` request. */
  requestCreate: (input: {
    body: RichTextDocument;
    parentId: null | TId;
  }) => Promise<ContentCommentsApiResponse>;
  /** Sends an edit, as `useContentPublicWrite`'s `submit` request. */
  requestSave: (
    id: TId,
    input: { body: RichTextDocument; expectedVersion: number | undefined },
  ) => Promise<ContentCommentsApiResponse>;
  /** Retries the first load after an error. */
  retry: () => Promise<unknown>;
  /** Asks again for what a failed background refresh missed; resolves when done. */
  retryRefresh: () => Promise<void>;
  /** Marks one comment busy while its editor loads, so its menu waits. */
  setEditing: (id: null | TId) => void;
  /**
   * Live only: reads the comments that appeared at the end of the thread and
   * appends them below the loaded ones. Resolves to `false` when that failed.
   */
  showNewComments: () => Promise<boolean>;
  /**
   * `pending` before the first page, `error` when it failed, then `success` -
   * also after a failed background refresh, which `refreshError` reports.
   */
  status: "error" | "pending" | "success";
  /**
   * Call with `true` while an edit or reply form is open on `id`, and `false`
   * when it closes. If a live update removes that comment meanwhile, it stays
   * on screen with `removed: true` and its text, so the form keeps what was
   * typed and can say why it can no longer be sent.
   */
  trackDraft: (id: TId, open: boolean) => void;
  /** The loaded comments as a tree, replies under their parents. */
  tree: ContentCommentTreeNode<TRecord, TId>[];
  /** `true` when a page held more nested replies than one answer carries. */
  truncated: boolean;
  /** Shows a hidden comment again. */
  unhide: (id: TId) => Promise<ContentCommentActionResult>;
  /** The signed-in visitor's id, or `null`. */
  userId: null | number;
  /**
   * What a successful create or edit became, after refreshing the thread.
   * Call it with the record `useContentPublicWrite`'s `submit` returned; an
   * answer it cannot read counts as `draft`, never as posted.
   */
  written: (record: unknown) => Promise<ContentCommentWriteOutcome>;
}

/**
 * Keeps what the reader is reading in place when comments above the viewport
 * change: `capture` (called right before the change) remembers the first
 * comment whose top is on screen; after the next commit the page scrolls by
 * however far it moved. Browser scroll anchoring alone misses changes it does
 * not attribute to the anchor, and does nothing in some browsers.
 */
const useScrollAnchor = (pages: unknown): (() => void) => {
  const anchorRef = React.useRef<null | { element: Element; top: number }>(
    null,
  );

  React.useLayoutEffect(() => {
    const captured = anchorRef.current;
    anchorRef.current = null;
    if (!captured?.element.isConnected) return;
    const shift = captured.element.getBoundingClientRect().top - captured.top;
    if (Math.abs(shift) >= 1) window.scrollBy(0, shift);
  }, [pages]);

  return React.useCallback(() => {
    if (typeof document === "undefined") return;
    for (const element of document.querySelectorAll(
      `[id^="${CONTENT_COMMENT_ANCHOR_PREFIX}"]`,
    )) {
      const { top } = element.getBoundingClientRect();
      if (top >= 0) {
        anchorRef.current = { element, top };

        return;
      }
    }
  }, []);
};

/**
 * The live controller of one thread, when `branches` is wired: rebuilt when
 * the thread's key changes, following the query cache while mounted, and
 * always reading through the latest callbacks.
 */
const useLiveThread = <R extends ContentCommentsApiResponse, TRecord>({
  beforeChange,
  branches,
  pageSize,
  queryClient,
  queryKey,
  record,
  thread,
}: Pick<ContentCommentsConfig<R, TRecord>, "branches" | "record" | "thread"> & {
  beforeChange: () => void;
  pageSize: number;
  queryClient: QueryClient;
  queryKey: QueryKey;
}): ContentCommentsLive<TRecord, ContentCommentIdOf<R>> | null => {
  type TId = ContentCommentIdOf<R>;

  const enabled = Boolean(branches);
  const key = `${hashKey(queryKey)}|${enabled ? "live" : "off"}`;
  const create = () =>
    enabled
      ? createContentCommentsLive<TRecord, TId>({
          permissionsKey: [...queryKey, "permissions"],
          queryClient,
          threadKey: [...queryKey, "thread"],
        })
      : null;
  const [state, setState] = React.useState(() => ({
    key,
    live: create(),
    queryClient,
  }));
  let { live } = state;
  if (state.key !== key || state.queryClient !== queryClient) {
    live = create();
    setState({ key, live, queryClient });
  }

  React.useEffect(() => {
    live?.setSource({
      beforeChange,
      readBranches: async ids => {
        if (!branches) {
          throw new ContentCommentsRequestError(0, "No `branches`.");
        }
        const res = await branches(ids);
        if (!res.ok) {
          throw new ContentCommentsRequestError(
            res.status,
            `Refreshing the comments answered ${res.status}.`,
          );
        }
        // The typed response's `2xx` member is the branches route's answer.
        const body = (await res.json()) as ContentCommentsBranches<
          TRecord,
          TId
        >;

        return {
          ...body,
          branches: body.branches.map(branch =>
            branch.status === "ok"
              ? { ...branch, items: parseNodes(branch.items, record) }
              : branch,
          ),
        };
      },
      readPage: async after =>
        await readContentCommentsPage({
          after,
          first: pageSize,
          record,
          thread,
        }),
    });
  });
  React.useEffect(() => live?.attach(), [live]);

  return live;
};

/**
 * The state and actions of one comment thread under a Content Engine record:
 * paginated loading, the reply tree, batched permissions for the comments on
 * screen, and create, edit, delete, hide and restore through the plugin's own
 * typed callbacks. A write refreshes the thread and its permissions only after
 * the server accepted it - only the branch it touched when `branches` is
 * given - and a second action on the same thread waits until the first one
 * settles. With `live`, other readers' changes arrive over the shared
 * WebSocket: changed branches are re-read and merged in place, new comments
 * wait for `showNewComments()`, and a failed background read keeps the
 * comments on screen and sets `refreshError`.
 *
 * It renders nothing and shows no messages: hand it to `ContentComments` for
 * the default section, or to `ContentCommentsRoot` to lay out your own. The
 * server stays the authority - buttons follow its `can*` answers, an unknown
 * or failed answer reads as "not allowed", and a refused action reports its
 * status. Browser-only.
 *
 * @example
 * ```tsx
 * import { ContentComments, useContentComments } from "@vitnode/core/tanstack/comments";
 * import { fetcher } from "@vitnode/core/tanstack/fetcher";
 *
 * const comments = useContentComments({
 *   queryKey: [manifest.id, "comments", article.id],
 *   thread: async ({ after, first }) =>
 *     await fetcher({
 *       plugin: manifest.id,
 *       method: "get",
 *       module: "content/comments",
 *       path: "/thread",
 *       args: { query: { root: String(article.id), first, ...(after ? { after } : {}) } },
 *     }),
 *   create: async ({ body, parentId }) =>
 *     await fetcher({
 *       plugin: manifest.id,
 *       method: "post",
 *       module: "content/comments",
 *       path: "/",
 *       args: { body: { values: { article: article.id, body, parent: parentId } } },
 *     }),
 * });
 *
 * <ContentComments comments={comments} />;
 * ```
 */
export const useContentComments = <
  R extends ContentCommentsApiResponse,
  TRecord = ContentCommentRecordOf<R>,
>(
  config: ContentCommentsConfig<R, TRecord>,
): ContentCommentsController<TRecord, ContentCommentIdOf<R>> => {
  type TId = ContentCommentIdOf<R>;

  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const {
    allowed = true,
    branches: requestBranches,
    create,
    delete: remove,
    edit,
    live: liveConfig,
    maxDepth,
    onChanged,
    pageSize,
    queryKey,
    record,
    report,
    thread,
    visibility,
  } = config;
  const field = config.field ?? "body";
  const signedIn = Boolean(session.data?.user);

  const comments = useInfiniteQuery(
    contentCommentsQueryOptions({ pageSize, queryKey, record, thread }),
  );
  const pages = comments.data?.pages;
  const items = React.useMemo<ContentCommentNode<TRecord, TId>[]>(
    () => pages?.flatMap(page => page.items) ?? [],
    [pages],
  );
  // Hands back the previous tree's nodes for unchanged branches, so one live
  // update re-renders only the branch it touched.
  const [shareTree] = React.useState(() => {
    let previous: ContentCommentTreeNode<TRecord, TId>[] = [];

    return (next: ContentCommentTreeNode<TRecord, TId>[]) => {
      previous = shareContentCommentTree(previous, next);

      return previous;
    };
  });
  const tree = React.useMemo(
    () => shareTree(buildContentCommentTree(items)),
    [items, shareTree],
  );

  const captureScrollAnchor = useScrollAnchor(pages);
  const live = useLiveThread<R, TRecord>({
    beforeChange: captureScrollAnchor,
    branches: requestBranches,
    pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
    queryClient,
    queryKey,
    record,
    thread,
  });
  const liveSnapshot = React.useSyncExternalStore(
    live?.subscribe ?? noopSubscribe,
    live?.getSnapshot ?? emptySnapshot,
    live?.getSnapshot ?? emptySnapshot,
  );

  const liveContentTypeId = liveConfig?.contentTypeId;
  const liveRootId = liveConfig?.rootId;
  const liveScope = React.useMemo(
    () =>
      live && liveContentTypeId !== undefined && liveRootId !== undefined
        ? {
            contentTypeId: liveContentTypeId,
            kind: "thread" as const,
            rootId: liveRootId,
          }
        : null,
    [live, liveContentTypeId, liveRootId],
  );
  const liveStatus = useContentLiveRefresh(liveScope, {
    onDenied: () => {
      live?.reconcile();
    },
    onSignal: signal => {
      live?.signal(signal);
    },
    onSubscribed: ({ reconnect }) => {
      live?.reconcile({ jitter: reconnect });
    },
  });
  const trackDraft = React.useCallback(
    (id: TId, open: boolean) => {
      live?.trackDraft(id, open);
    },
    [live],
  );

  // Where the last write landed, so `written` refreshes only that branch.
  const lastWriteRef = React.useRef<null | WriteTarget<TId>>(null);

  const requestPermissions = config.permissions;
  const permissions = useContentPermissions<TId>({
    ids: requestPermissions
      ? items.flatMap(item => (item.record ? [item.id] : []))
      : [],
    queryKey,
    fetch: async ids => {
      if (!requestPermissions) return { items: [] };
      const res = await requestPermissions(ids);
      if (!res.ok) throw new Error("Loading permissions failed.");

      // The typed response's `2xx` member is the permissions route's answer.
      return (await res.json()) as ContentPermissionsResponse<TId>;
    },
  });

  const [busy, setBusy] = React.useState<ContentCommentBusy<TId> | null>(null);
  // Read and written only by event handlers: a second click lands before the
  // re-render that disables its button.
  const busyRef = React.useRef<ContentCommentBusy<TId> | null>(null);
  const markBusy = (next: ContentCommentBusy<TId> | null) => {
    busyRef.current = next;
    setBusy(next);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      onChanged?.(queryClient),
    ]);
  };

  // After a write: only the branch it touched, when `branches` is wired.
  const refreshAfterWrite = async (target: null | WriteTarget<TId>) => {
    if (!live || !target) {
      await refresh();

      return;
    }
    await Promise.all([
      "id" in target
        ? live.refresh([target.id])
        : target.parentId === null
          ? live.refreshTail()
          : live.refresh([target.parentId]),
      onChanged?.(queryClient),
    ]);
  };

  const run = async (
    id: TId,
    action: ContentCommentBusy<TId>["action"],
    request: () => Promise<ContentCommentsApiResponse>,
  ): Promise<ContentCommentActionResult> => {
    if (busyRef.current) return { ok: false, status: 409 };
    markBusy({ action, id });
    try {
      const res = await request().catch(() => null);
      if (!res) return { ok: false, status: 0 };
      if (!res.ok) return { ok: false, status: res.status };
      await refreshAfterWrite({ id });

      return { ok: true };
    } finally {
      markBusy(null);
    }
  };

  const missing = { ok: false as const, status: 404 };

  return {
    busy,
    canComment: Boolean(create) && signedIn && allowed,
    commentLocked: signedIn && !allowed,
    canReply: node =>
      Boolean(create) &&
      signedIn &&
      allowed &&
      maxDepth !== undefined &&
      !node.hidden &&
      !node.removed &&
      node.depth < maxDepth,
    features: {
      create: Boolean(create),
      delete: Boolean(remove),
      edit: Boolean(edit),
      hide: Boolean(visibility),
      replies: maxDepth !== undefined,
      report: Boolean(report),
    },
    field,
    hasMore: comments.hasNextPage,
    hasNewComments: liveSnapshot.hasNew,
    hide: async (id, reason) =>
      visibility
        ? await run(
            id,
            "hide",
            async () => await visibility.hide(id, { reason }),
          )
        : missing,
    isLoadingMore: comments.isFetchingNextPage,
    isRefreshing:
      comments.isFetching &&
      !comments.isPending &&
      !comments.isFetchingNextPage,
    isSessionPending: session.isPending,
    items,
    liveStatus,
    loadEditable: async id => {
      if (!edit) return missing;
      const res = await edit.load(id).catch(() => null);
      if (!res) return { ok: false, status: 0 };
      if (!res.ok) return { ok: false, status: res.status };
      const value = readEditable(await res.json().catch(() => null), field);

      return value ? { ok: true, value } : { ok: false, status: 0 };
    },
    loadMore: async () => {
      const result = await comments.fetchNextPage();

      return !result.isError;
    },
    permissionsOf: permissions.of,
    refresh,
    refreshError: comments.isRefetchError || liveSnapshot.refreshError,
    remove: async id =>
      remove ? await run(id, "delete", async () => await remove(id)) : missing,
    replyCount: pages?.at(-1)?.replyCount ?? 0,
    reportTarget: id => report?.(id) ?? null,
    requestCreate: async input => {
      if (!create) throw new Error("This thread has no `create`.");
      lastWriteRef.current = { parentId: input.parentId };

      return await create(input);
    },
    requestSave: async (id, input) => {
      if (!edit) throw new Error("This thread has no `edit`.");
      lastWriteRef.current = { id };

      return await edit.save(id, input);
    },
    retry: async () => await comments.refetch(),
    retryRefresh: async () => {
      if (comments.isRefetchError) {
        await comments.refetch();

        return;
      }
      await live?.retry();
    },
    setEditing: id => {
      markBusy(id === null ? null : { action: "edit", id });
    },
    showNewComments: async () => (live ? await live.showNew() : false),
    status: comments.data ? "success" : comments.status,
    trackDraft,
    tree,
    truncated: pages?.some(page => page.truncated) ?? false,
    unhide: async id =>
      visibility
        ? await run(id, "unhide", async () => await visibility.unhide(id))
        : missing,
    userId: session.data?.user?.id ?? null,
    written: async record => {
      const target = lastWriteRef.current;
      lastWriteRef.current = null;
      await refreshAfterWrite(target);
      const parsed = zodWrittenRecord.safeParse(record);

      return parsed.success ? contentCommentWriteOutcome(parsed.data) : "draft";
    },
  };
};
