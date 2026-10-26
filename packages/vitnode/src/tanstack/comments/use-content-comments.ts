import type { QueryClient, QueryKey } from "@tanstack/react-query";

import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React from "react";
import { z } from "zod";

import type { ContentId } from "@/content/ids";
import type { RichTextDocument } from "@/content/rich-text";
import type { ContentTarget } from "@/content/target";

import { zodRichTextDocument } from "@/content/rich-text";

import type {
  ContentPermissions,
  ContentPermissionsResponse,
} from "../content/permissions";
import type {
  ContentCommentNode,
  ContentCommentsThreadPage,
  ContentCommentTreeNode,
  ContentCommentWriteOutcome,
} from "./thread";

import { useSessionQuery } from "../auth/session-query";
import { useContentPermissions } from "../content/permissions";
import { buildContentCommentTree, contentCommentWriteOutcome } from "./thread";

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
 * @throws An `Error` from `queryFn` when the thread route answers anything
 * but `2xx`.
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
    queryFn: async ({ pageParam }) => {
      const res = await thread({ after: pageParam, first: pageSize });
      if (!res.ok) {
        throw new Error(`Loading the comments answered ${res.status}.`);
      }

      // The typed response's `2xx` member is the thread route's answer, and
      // without `record` its records keep the type the route gives them.
      const page = (await res.json()) as ContentCommentsThreadPage<
        TRecord,
        ContentCommentIdOf<R>
      >;
      if (!record) return page;

      return {
        ...page,
        items: page.items.map(item => ({
          ...item,
          record: item.record === null ? null : record.parse(item.record),
        })),
      };
    },
    queryKey: [...queryKey, "thread"],
  });

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
  /** Whether the visitor may write a new comment here: signed in, with `create` given. */
  canComment: boolean;
  /** Whether **Reply** shows under `node`: replies allowed, under `maxDepth` and not hidden. */
  canReply: (node: ContentCommentNode<TRecord, TId>) => boolean;
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
  /** Hides one comment, with an optional reason of at most 500 characters. */
  hide: (id: TId, reason: null | string) => Promise<ContentCommentActionResult>;
  /** `true` while the next page loads. */
  isLoadingMore: boolean;
  /** `true` while a refetch runs over comments already on screen. */
  isRefreshing: boolean;
  /** `true` while the session is unknown, so the composer can wait for it. */
  isSessionPending: boolean;
  /** Every loaded entry, flat and depth first. */
  items: ContentCommentNode<TRecord, TId>[];
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
  /** Refreshes the thread, its permissions and `onChanged`'s queries. */
  refresh: () => Promise<void>;
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
  /** Marks one comment busy while its editor loads, so its menu waits. */
  setEditing: (id: null | TId) => void;
  /** `pending` before the first page, `error` when it failed, then `success`. */
  status: "error" | "pending" | "success";
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
 * The state and actions of one comment thread under a Content Engine record:
 * paginated loading, the reply tree, batched permissions for the comments on
 * screen, and create, edit, delete, hide and restore through the plugin's own
 * typed callbacks. A write refreshes the thread and its permissions only after
 * the server accepted it, and a second action on the same thread waits until
 * the first one settles.
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
    create,
    delete: remove,
    edit,
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
  const tree = React.useMemo(() => buildContentCommentTree(items), [items]);

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
      await refresh();

      return { ok: true };
    } finally {
      markBusy(null);
    }
  };

  const missing = { ok: false as const, status: 404 };

  return {
    busy,
    canComment: Boolean(create) && signedIn,
    canReply: node =>
      Boolean(create) &&
      signedIn &&
      maxDepth !== undefined &&
      !node.hidden &&
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
    hide: async (id, reason) =>
      visibility
        ? await run(
            id,
            "hide",
            async () => await visibility.hide(id, { reason }),
          )
        : missing,
    isLoadingMore: comments.isFetchingNextPage,
    isRefreshing: comments.isFetching && !comments.isPending,
    isSessionPending: session.isPending,
    items,
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
    remove: async id =>
      remove ? await run(id, "delete", async () => await remove(id)) : missing,
    replyCount: pages?.at(-1)?.replyCount ?? 0,
    reportTarget: id => report?.(id) ?? null,
    requestCreate: async input => {
      if (!create) throw new Error("This thread has no `create`.");

      return await create(input);
    },
    requestSave: async (id, input) => {
      if (!edit) throw new Error("This thread has no `edit`.");

      return await edit.save(id, input);
    },
    retry: async () => await comments.refetch(),
    setEditing: id => {
      markBusy(id === null ? null : { action: "edit", id });
    },
    status: comments.status,
    tree,
    truncated: pages?.some(page => page.truncated) ?? false,
    unhide: async id =>
      visibility
        ? await run(id, "unhide", async () => await visibility.unhide(id))
        : missing,
    userId: session.data?.user?.id ?? null,
    written: async record => {
      await refresh();
      const parsed = zodWrittenRecord.safeParse(record);

      return parsed.success ? contentCommentWriteOutcome(parsed.data) : "draft";
    },
  };
};
