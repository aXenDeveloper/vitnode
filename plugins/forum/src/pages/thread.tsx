import type { ContentPermissions } from "@vitnode/core/tanstack/content";

import { useQueryClient } from "@tanstack/react-query";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { contentTarget, zodRichTextDocument } from "@vitnode/core/content";
import { useRevealHashTarget } from "@vitnode/core/hooks/use-reveal-hash-target";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { ContentAccessRequired } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { cn } from "cn";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MessageSquareIcon,
  PencilIcon,
  ReplyIcon,
} from "lucide-react";
import {
  Activity,
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { commentContentType, FORUM_COMMENT_MAX_DEPTH } from "@/content/comment";
import { manifest } from "@/manifest.gen";

import type { CommentComposerProps } from "./comment-composer";
import type { ThreadComment, ThreadPage, ThreadTreeNode } from "./thread-data";

import { useForumRejection } from "./forum-errors";
import { commentAnchorId, loginHref, topicHref } from "./forum-links";
import { useCommentPermissions } from "./forum-permissions";
import { invalidateForumComments } from "./forum-queries";
import { PersonAvatar, PersonName, TimeAgo } from "./forum-ui";
import {
  buildThreadTree,
  countDescendants,
  fetchThreadPage,
  THREAD_MAX_PAGE_SIZE,
  THREAD_PAGE_SIZE,
} from "./thread-data";

const loadCommentComposer = async () => await import("./comment-composer");

const CommentComposer = lazy(loadCommentComposer);

/** Starts the editor chunk on intent, so a click rarely waits for it. */
const preloadCommentComposer = () => {
  void loadCommentComposer();
};

const ComposerFallback = () => (
  <div
    aria-hidden="true"
    className="bg-muted h-40 w-full animate-pulse rounded-lg"
  />
);

const LazyCommentComposer = (props: CommentComposerProps) => (
  <Suspense fallback={<ComposerFallback />}>
    <CommentComposer {...props} />
  </Suspense>
);

const zodProposedBody = z
  .object({ body: zodRichTextDocument.optional() })
  .catch({});

/** Edits open on the latest text the author wrote, a pending proposal included. */
const useCommentEditor = () => {
  const reject = useForumRejection([]);
  const t = useTranslations("@vitnode/forum.forums.errors");

  return async (commentId: number) => {
    const res = await fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/comments",
      path: "/{id}/edit",
      args: { params: { id: commentId } },
    });

    if (res.status !== 200) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        await reject(res);
      } else {
        toast.error(t("title"), { description: t("unknown") });
      }

      return null;
    }

    const record = await res.json();
    const { approval } = record;
    const proposed =
      approval?.status === "pending" && approval.kind === "edit"
        ? zodProposedBody.parse(approval.values ?? {})
        : {};

    return {
      body: proposed.body ?? record.values.body,
      version: record.version,
    };
  };
};

interface ThreadActions {
  canComment: boolean;
  /** The comment a `#comment-{slug}` link points at, once it is on screen. */
  highlightedId: null | string;
  onChanged: (outcome: { pending: boolean }) => void;
  /** What the visitor may do with each comment, from the Content Engine. */
  permissionsOf: (id: number) => ContentPermissions;
  topicId: number;
  topicSlug: string;
}

const CommentBody = ({
  actions,
  node,
  comment,
}: {
  actions: ThreadActions;
  comment: ThreadComment;
  node: ThreadTreeNode;
}) => {
  const t = useTranslations("@vitnode/forum.comments");
  const openEditor = useCommentEditor();
  const [mode, setMode] = useState<"idle" | "reply">("idle");
  const [editing, setEditing] = useState<null | {
    body: ThreadComment["body"];
    version: number;
  }>(null);
  const [isOpeningEditor, setIsOpeningEditor] = useState(false);
  const { canEdit, canReport } = actions.permissionsOf(comment.id);
  const canAnswer = actions.canComment && node.depth < FORUM_COMMENT_MAX_DEPTH;
  const authorId = `${commentAnchorId(comment.slug)}-author`;
  const edited =
    comment.publishedAt !== null &&
    new Date(comment.updatedAt).getTime() -
      new Date(comment.publishedAt).getTime() >
      60_000;

  return (
    <div className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
        <PersonAvatar person={comment.author} size={24} />
        <span id={authorId}>
          <PersonName person={comment.author} />
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <HrefLink
          className="text-muted-foreground hover:text-foreground hover:underline"
          href={`${topicHref(actions.topicSlug)}#${commentAnchorId(comment.slug)}`}
        >
          <TimeAgo date={comment.publishedAt ?? comment.createdAt} />
          <span className="sr-only"> {t("permalink")}</span>
        </HrefLink>
        {edited ? (
          <span className="text-muted-foreground">({t("edited_label")})</span>
        ) : null}
      </header>

      {editing ? (
        <LazyCommentComposer
          autoFocus
          commentId={comment.id}
          defaultBody={editing.body}
          expectedVersion={editing.version}
          label={t("form.edit_label")}
          mode="edit"
          onCancel={() => {
            setEditing(null);
          }}
          onDone={outcome => {
            setEditing(null);
            actions.onChanged(outcome);
          }}
        />
      ) : (
        <RichTextContent
          className="text-foreground leading-relaxed text-pretty"
          content={comment.body}
        />
      )}

      {editing ? null : (
        <div className="flex flex-wrap items-center gap-1">
          {canAnswer ? (
            <Button
              aria-expanded={mode === "reply"}
              onClick={() => {
                setMode(mode === "reply" ? "idle" : "reply");
              }}
              onFocus={preloadCommentComposer}
              onPointerEnter={preloadCommentComposer}
              size="sm"
              variant="ghost"
            >
              <ReplyIcon aria-hidden="true" />
              {t("reply")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              isLoading={isOpeningEditor}
              onClick={async () => {
                setIsOpeningEditor(true);
                const editable = await openEditor(comment.id);
                setIsOpeningEditor(false);
                if (editable) setEditing(editable);
              }}
              onFocus={preloadCommentComposer}
              onPointerEnter={preloadCommentComposer}
              size="sm"
              variant="ghost"
            >
              <PencilIcon aria-hidden="true" />
              {t("edit")}
            </Button>
          ) : null}
          {canReport ? (
            <ReportButton
              className="text-muted-foreground"
              describedBy={authorId}
              target={contentTarget(
                manifest.id,
                commentContentType,
                comment.id,
              )}
              typeLabel={t("report_type")}
            />
          ) : null}
        </div>
      )}

      {mode === "reply" ? (
        <LazyCommentComposer
          autoFocus
          label={t("form.answer_label", {
            name: comment.author?.name ?? t("someone"),
          })}
          mode="create"
          onCancel={() => {
            setMode("idle");
          }}
          onDone={outcome => {
            setMode("idle");
            actions.onChanged(outcome);
          }}
          parentId={comment.id}
          topicId={actions.topicId}
        />
      ) : null}
    </div>
  );
};

// Memoized so a parent re-render that leaves the tree alone - the session
// resolving, "load more" spinning, the composer opening - skips every comment.
const ThreadNodeView = memo(
  ({
    actions,
    descendants,
    node,
  }: {
    actions: ThreadActions;
    descendants: ReadonlyMap<number, number>;
    node: ThreadTreeNode;
  }) => {
    const t = useTranslations("@vitnode/forum.comments");
    const [isCollapsed, setIsCollapsed] = useState(false);
    const hidden = descendants.get(node.id) ?? 0;
    const childrenId = `comment-children-${node.id}`;
    const anchorId = node.record
      ? commentAnchorId(node.record.slug)
      : undefined;

    return (
      <li
        className={cn(
          "flex scroll-mt-24 flex-col gap-3 outline-none",
          anchorId !== undefined &&
            anchorId === actions.highlightedId &&
            "bg-muted text-foreground rounded-lg p-3",
        )}
        id={anchorId}
        // Focusable from script only, so a notification link lands on it.
        tabIndex={anchorId === undefined ? undefined : -1}
      >
        {node.record ? (
          <CommentBody actions={actions} comment={node.record} node={node} />
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed italic">
            {t("removed")}
          </p>
        )}

        {node.children.length > 0 ? (
          <>
            <Button
              aria-controls={childrenId}
              aria-expanded={!isCollapsed}
              className="self-start"
              onClick={() => {
                setIsCollapsed(!isCollapsed);
              }}
              size="sm"
              variant="link"
            >
              {isCollapsed ? (
                <ChevronRightIcon aria-hidden="true" />
              ) : (
                <ChevronDownIcon aria-hidden="true" />
              )}
              {isCollapsed
                ? t("show_answers", { count: hidden })
                : t("hide_answers", { count: hidden })}
            </Button>
            <Activity mode={isCollapsed ? "hidden" : "visible"}>
              <ol
                className={cn(
                  "flex flex-col gap-6 border-l-2",
                  // Deep threads stop indenting on small screens, so a comment six
                  // levels down still has room for its text.
                  node.depth >= 3 ? "pl-2 md:pl-6" : "pl-3 md:pl-6",
                )}
                id={childrenId}
              >
                {node.children.map(child => (
                  <ThreadNodeView
                    actions={actions}
                    descendants={descendants}
                    key={child.id}
                    node={child}
                  />
                ))}
              </ol>
            </Activity>
          </>
        ) : null}
      </li>
    );
  },
);

export const ForumThread = ({
  canReply = true,
  initial,
  topicId,
  topicSlug,
}: {
  /**
   * Whether the forum's access rules let this viewer reply, as the server
   * reported it. The server checks again on every reply.
   */
  canReply?: boolean;
  initial: ThreadPage;
  topicId: number;
  topicSlug: string;
}) => {
  const t = useTranslations("@vitnode/forum.comments");
  const queryClient = useQueryClient();
  const { data: session, isPending: isSessionPending } = useSessionQuery();
  const currentUserId = session?.user?.id ?? null;
  const [pages, setPages] = useState<ThreadPage[]>([initial]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [composerKey, setComposerKey] = useState(0);
  const [composer, setComposer] = useState<"closed" | "open" | "opening">(
    "closed",
  );

  const last = pages.at(-1) ?? initial;
  const items = useMemo(() => pages.flatMap(page => page.items), [pages]);
  const tree = useMemo(() => buildThreadTree(items), [items]);
  const descendants = useMemo(() => countDescendants(tree), [tree]);
  const permissions = useCommentPermissions(
    items.flatMap(item => (item.record ? [item.id] : [])),
  );
  const commentCount = last.commentCount;

  const loadMore = async () => {
    if (!last.pageInfo.endCursor) return;
    setIsLoadingMore(true);
    try {
      const next = await fetchThreadPage({
        after: last.pageInfo.endCursor,
        topicId,
      });
      if (next) setPages([...pages, next]);
    } catch {
      toast.error(t("load_failed.title"), {
        description: t("load_failed.desc"),
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  const refresh = useCallback(async () => {
    const loaded = items.filter(item => item.depth === 1).length;
    try {
      const fresh = await fetchThreadPage({
        // One more than is on screen, so a new top-level comment at the end of
        // the conversation shows up without another click.
        first: Math.min(
          THREAD_MAX_PAGE_SIZE,
          Math.max(THREAD_PAGE_SIZE, loaded + 1),
        ),
        topicId,
      });
      if (fresh) setPages([fresh]);
    } catch {
      toast.error(t("load_failed.title"), {
        description: t("load_failed.desc"),
      });
    }
  }, [items, t, topicId]);

  const onChanged = useCallback(
    ({ pending }: { pending: boolean }) => {
      void invalidateForumComments(queryClient, topicId);
      if (!pending) void refresh();
    },
    [queryClient, refresh, topicId],
  );

  // A notification links to `#comment-{slug}`, which may be on a later page.
  const anchor = useRevealHashTarget({
    hasMore: last.pageInfo.hasNextPage,
    isLoadingMore,
    loadMore,
    prefix: "comment-",
    ready: true,
    renderedCount: items.length,
  });
  const highlightedId = anchor.status === "found" ? anchor.targetId : null;

  const actions = useMemo<ThreadActions>(
    () => ({
      canComment: currentUserId !== null && canReply,
      highlightedId,
      onChanged,
      permissionsOf: permissions.of,
      topicId,
      topicSlug,
    }),
    [
      canReply,
      currentUserId,
      highlightedId,
      onChanged,
      permissions.of,
      topicId,
      topicSlug,
    ],
  );

  return (
    <section aria-labelledby="forum-comments" className="flex flex-col gap-6">
      <h2
        className="text-foreground flex items-center gap-2 text-xl font-semibold text-balance"
        id="forum-comments"
      >
        <MessageSquareIcon aria-hidden="true" className="size-5" />
        {t("title", { count: commentCount })}
      </h2>

      {tree.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h3 />}>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.desc")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-6">
          {tree.map(node => (
            <ThreadNodeView
              actions={actions}
              descendants={descendants}
              key={node.id}
              node={node}
            />
          ))}
        </ol>
      )}

      {anchor.status === "missing" ? (
        <p
          className="text-muted-foreground text-sm leading-relaxed"
          role="status"
        >
          {t("anchor_missing")}
        </p>
      ) : null}

      {last.truncated ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("truncated")}
        </p>
      ) : null}

      {last.pageInfo.hasNextPage ? (
        <Button
          className="self-start"
          isLoading={isLoadingMore}
          onClick={loadMore}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}

      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
        <h3 className="text-foreground font-semibold text-balance">
          {t("compose.title")}
        </h3>
        {isSessionPending ? (
          <ComposerFallback />
        ) : currentUserId === null ? (
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("compose.guest")}{" "}
            <HrefLink
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={loginHref(topicHref(topicSlug))}
            >
              {t("compose.sign_in")}
            </HrefLink>
          </p>
        ) : canReply ? null : (
          <ContentAccessRequired headingLevel="h3" kind="comment" />
        )}
        {isSessionPending ||
        currentUserId === null ||
        !canReply ? null : composer === "closed" ? (
          // The editor is a heavy chunk most readers never need, so it waits
          // for intent: hovering or focusing this starts the download, and a
          // click swaps it in with the caret already inside.
          <Button
            className="text-muted-foreground h-auto justify-start py-3 font-normal"
            onClick={() => {
              setComposer("opening");
            }}
            onFocus={preloadCommentComposer}
            onPointerEnter={preloadCommentComposer}
            variant="outline"
          >
            <PencilIcon aria-hidden="true" />
            {t("compose.open")}
          </Button>
        ) : (
          <LazyCommentComposer
            // Only the reader's own click moves focus; the fresh, empty editor
            // that replaces a posted comment leaves focus alone.
            autoFocus={composer === "opening"}
            key={composerKey}
            label={t("form.body_label")}
            mode="create"
            onDone={outcome => {
              setComposer("open");
              setComposerKey(composerKey + 1);
              onChanged(outcome);
            }}
            parentId={null}
            topicId={topicId}
          />
        )}
      </div>
    </section>
  );
};
