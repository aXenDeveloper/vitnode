import type { ContentId } from "@vitnode/api/content/ids";

import { useQueryClient } from "@tanstack/react-query";
import { zodRichTextDocument } from "@vitnode/api/content/rich-text";
import { cn } from "cn";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  ChevronDownIcon,
  EyeOffIcon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  PencilIcon,
  ReplyIcon,
  RotateCwIcon,
  TrendingUpIcon,
} from "lucide-react";
import React from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { UserFormat } from "@/components/user-format";
import { UserPreview } from "@/components/user-preview";
import { useRevealHashTarget } from "@/hooks/use-reveal-hash-target";
import {
  reactionsCatalogQueryOptions,
  reactionSummaryQueryOptions,
} from "@/tanstack/reactions/query";
import { ReactionBar } from "@/tanstack/reactions/reaction-bar";
import { reactionPoints } from "@/tanstack/reactions/reaction-points";

import type {
  AnyCommentsDisplay,
  CardThreadContextValue,
  CommentTreeNode,
  ContentCommentsDisplay,
} from "./card-thread";
import type { ContentCommentNode } from "./thread";
import type { ContentCommentsController } from "./use-content-comments";

import { ContentAccessRequired } from "../content/access-required";
import { contentCommentAuthor, contentCommentAuthorName } from "./author";
import {
  CardThreadContext,
  commentAnchorIdOf,
  ContentCommentCard,
  nodeTime,
} from "./card-thread";
import {
  ContentCommentActions,
  ContentCommentComposer,
  preloadContentCommentComposer,
  useContentCommentItem,
} from "./item";
import { ContentCommentsRoot, useContentCommentsContext } from "./root";
import { CONTENT_COMMENT_ANCHOR_PREFIX } from "./thread";

const EDITED_AFTER_MS = 60_000;

export { CONTENT_COMMENT_ANCHOR_PREFIX };

export type { ContentCommentsDisplay };

type AnyDisplay = AnyCommentsDisplay;

const recordField = (record: unknown, name: string): unknown =>
  typeof record === "object" && record !== null && name in record
    ? (record as Record<string, unknown>)[name]
    : undefined;

const readDate = (record: unknown, name: string): null | string => {
  const value = recordField(record, name);

  return typeof value === "string" ? value : null;
};

/** The element id of a comment, e.g. `comment-42`. */
const anchorIdOf = (
  node: ContentCommentNode<unknown>,
  display: AnyDisplay,
): null | string =>
  node.record
    ? `${CONTENT_COMMENT_ANCHOR_PREFIX}${display.anchorKey ? display.anchorKey(node.record) : String(node.id)}`
    : null;

const CommentBody = ({ record }: { record: unknown }) => {
  const { comments } = useContentCommentsContext();
  const parsed = zodRichTextDocument.safeParse(
    recordField(record, comments.field),
  );

  return parsed.success ? (
    <RichTextContent
      className="text-foreground leading-relaxed text-pretty"
      content={parsed.data}
    />
  ) : null;
};

/**
 * The anonymous stand-in for a comment that was deleted, or hidden from this
 * reader, while it still had replies. Shows no text and no author.
 */
export const ContentCommentPlaceholder = ({
  className,
  node,
}: {
  className?: string;
  node: ContentCommentNode<unknown>;
}) => {
  const t = useTranslations("core.comments");
  const { deleted } = node;

  return (
    <div
      className={cn(
        "bg-muted/40 text-muted-foreground flex w-fit max-w-full flex-col gap-0.5 rounded-2xl rounded-ss-sm border border-dashed px-4 py-2.5",
        className,
      )}
    >
      <p className="flex min-w-0 items-center gap-1.5 text-sm leading-relaxed">
        <span className="font-medium">{t("placeholder.name")}</span>
        {deleted ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap">
            <span aria-hidden="true">·</span>
            <time dateTime={deleted.createdAt}>
              <DateFormat date={deleted.createdAt} />
            </time>
          </span>
        ) : null}
      </p>
      <p className="leading-relaxed text-pretty">
        {deleted
          ? deleted.byAuthor
            ? t("placeholder.by_author")
            : t("placeholder.by_moderator")
          : t("removed")}
      </p>
    </div>
  );
};

/**
 * One comment as the default section draws it: author, date, text and hidden
 * state, the **Reply** button, the actions menu, and the edit and reply forms
 * in place. A placeholder stands in for a removed comment.
 */
export const ContentCommentItem = <TRecord,>({
  display = {},
  highlighted = false,
  node,
}: {
  display?: ContentCommentsDisplay<TRecord>;
  /** Rings the comment a `#comment-...` link pointed to. */
  highlighted?: boolean;
  node: ContentCommentNode<TRecord>;
}) => {
  const t = useTranslations("core.comments");
  const item = useContentCommentItem(node);
  const options = display as AnyDisplay;
  const { record } = node;

  if (!record) {
    return <ContentCommentPlaceholder node={node} />;
  }

  const anchorId = anchorIdOf(node, options) ?? "";
  const authorId = `${anchorId}-author`;
  const person = contentCommentAuthor(record);
  const name = contentCommentAuthorName(person);
  const publishedAt = readDate(record, "publishedAt");
  const updatedAt = readDate(record, "updatedAt");
  const date = publishedAt ?? readDate(record, "createdAt");
  const isEdited =
    publishedAt !== null &&
    updatedAt !== null &&
    new Date(updatedAt).getTime() - new Date(publishedAt).getTime() >
      EDITED_AFTER_MS;

  if (item.editing) {
    return (
      <ContentCommentComposer
        autoFocus
        editable={item.editing}
        id={node.id}
        label={t("form.edit_label")}
        mode="edit"
        onCancel={item.stopEditing}
        onDone={item.stopEditing}
        unavailable={item.isRemoved ? t("live.edit_removed") : undefined}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 gap-3">
      {person ? (
        <UserPreview
          className="shrink-0 rounded-full"
          decorative
          nameCode={person.nameCode}
        >
          <Avatar alt="" className="size-8" size={32} user={person} />
        </UserPreview>
      ) : (
        <span
          aria-hidden="true"
          className="bg-muted size-8 shrink-0 rounded-full"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <article
          aria-labelledby={authorId}
          className={cn(
            "flex w-fit max-w-full min-w-0 flex-col gap-0.5 rounded-2xl rounded-ss-sm px-4 py-2.5",
            node.hidden
              ? "bg-muted/40 border border-dashed"
              : "bg-card text-card-foreground border",
            highlighted && "ring-primary/50 ring-2",
          )}
        >
          <header className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm leading-relaxed">
            <span className="min-w-0 truncate" id={authorId}>
              {options.render?.author ? (
                options.render.author(record)
              ) : person ? (
                <UserFormat
                  className="text-foreground min-w-0 truncate"
                  format
                  link
                  user={person}
                />
              ) : (
                <span className="text-muted-foreground font-medium">
                  {t("deleted_user")}
                </span>
              )}
            </span>
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap">
              {date ? (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    className="hover:text-foreground rounded-sm tabular-nums hover:underline"
                    href={
                      options.permalink
                        ? options.permalink(anchorId)
                        : `#${anchorId}`
                    }
                  >
                    <time dateTime={new Date(date).toISOString()}>
                      <DateFormat date={date} />
                    </time>
                    <span className="sr-only"> {t("permalink")}</span>
                  </a>
                </>
              ) : null}
              {isEdited ? <span>· {t("edited_label")}</span> : null}
              {node.hidden ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  · <EyeOffIcon aria-hidden="true" className="size-3.5" />
                  {t("visibility.hidden_label")}
                </span>
              ) : null}
            </span>
            {options.render?.meta?.(record)}
          </header>
          <div className={cn(node.hidden && "opacity-70")}>
            {options.render?.body ? (
              options.render.body(record)
            ) : (
              <CommentBody record={record} />
            )}
          </div>
          {node.hidden && node.hiddenReason ? (
            <p className="text-muted-foreground border-t border-dashed pt-1.5 text-sm leading-relaxed text-pretty">
              {t("visibility.hidden_reason", { reason: node.hiddenReason })}
            </p>
          ) : null}
        </article>

        <div className="flex flex-wrap items-center gap-1 ps-2">
          {item.reactionTarget && !node.hidden ? (
            <ReactionBar className="me-1" target={item.reactionTarget} />
          ) : null}
          {item.canReply ? (
            <Button
              aria-expanded={item.isReplying}
              className="text-muted-foreground font-semibold"
              onClick={() => {
                item.setIsReplying(!item.isReplying);
              }}
              onFocus={preloadContentCommentComposer}
              onPointerEnter={preloadContentCommentComposer}
              size="sm"
              variant="ghost"
            >
              <ReplyIcon aria-hidden="true" />
              {t("reply")}
            </Button>
          ) : null}
          {options.render?.actions?.(record)}
          <ContentCommentActions item={item} node={node} />
        </div>

        {item.isReplying ? (
          <div className="pt-2">
            <ContentCommentComposer
              autoFocus
              label={t("form.answer_label", { name: name ?? t("someone") })}
              mode="create"
              onCancel={() => {
                item.setIsReplying(false);
              }}
              onDone={() => {
                item.setIsReplying(false);
              }}
              parentId={node.id}
              unavailable={item.isRemoved ? t("live.reply_removed") : undefined}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const COMMENT_SKELETON_KEYS = ["first", "second", "third"];

const CommentsSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <span className="sr-only" role="status">
      {label}
    </span>
    {COMMENT_SKELETON_KEYS.map(key => (
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 rounded-lg border p-4"
        key={key}
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-4 w-2/3 max-w-sm" />
      </div>
    ))}
  </div>
);

/**
 * **Load more comments**, shown while more top-level comments wait on the
 * server. Tells the reader when loading failed.
 */
export const ContentCommentsLoadMore = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  if (!comments.hasMore) return null;

  return (
    <Button
      className={cn("self-start", className)}
      isLoading={comments.isLoadingMore}
      onClick={async () => {
        if (!(await comments.loadMore())) {
          toast.error(t("load_failed.title"), {
            description: t("load_failed.desc"),
          });
        }
      }}
      variant="outline"
    >
      <ChevronDownIcon aria-hidden="true" />
      {t("load_more")}
    </Button>
  );
};

/**
 * The divider above the first comment that other people posted while the
 * thread was open, such as "2 new comments", in the primary color. Renders a
 * list item, so place it inside the thread's `<ol>` right before that
 * comment; renders nothing when there are no new comments.
 *
 * @example
 * ```tsx
 * {comments.tree.map(node => (
 *   <React.Fragment key={String(node.id)}>
 *     {node.id === comments.newCommentIds[0] ? <ContentCommentsNewSeparator /> : null}
 *     <CommentBranch node={node} />
 *   </React.Fragment>
 * ))}
 * ```
 */
export const ContentCommentsNewSeparator = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const count = comments.newCommentIds.length;
  if (count === 0) return null;

  return (
    <li className={cn("flex items-center gap-2", className)}>
      <span aria-hidden="true" className="bg-primary/60 h-px min-w-0 flex-1" />
      <span className="border-primary/60 bg-background text-primary shrink-0 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums">
        {t("live.new_count", { count })}
      </span>
      <span aria-hidden="true" className="bg-primary/60 h-px min-w-0 flex-1" />
    </li>
  );
};

/**
 * The live state of the thread, for a section that renders its own layout:
 * a polite screen reader announcement when other people's comments were
 * added, and a notice with **Try again** when a background refresh failed -
 * the comments on screen stay. Renders nothing visible while there is
 * nothing to say.
 */
export const ContentCommentsLiveStatus = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const newCount = comments.newCommentIds.length;
  const announcement = [
    newCount > 0 ? t("live.new_count", { count: newCount }) : null,
    comments.refreshError ? t("live.refresh_failed") : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Always mounted, so a screen reader hears what is added to it. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {comments.refreshError ? (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>
          <p
            aria-hidden="true"
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
          >
            {t("live.refresh_failed")}
          </p>
          <Button
            isLoading={isRetrying || comments.isRefreshing}
            onClick={async () => {
              setIsRetrying(true);
              try {
                await comments.retryRefresh();
              } finally {
                setIsRetrying(false);
              }
            }}
            size="sm"
            variant="ghost"
          >
            <RotateCwIcon aria-hidden="true" />
            {t("live.retry")}
          </Button>
        </div>
      ) : null}
    </>
  );
};

/**
 * The new-comment card: the composer for a visitor who may comment, the
 * access notice when commenting is locked, or nothing for a guest or when the
 * thread has no `create`.
 */
export const ContentCommentsComposer = ({
  className,
  hideLabel = false,
  showTitle = true,
}: {
  className?: string;
  hideLabel?: boolean;
  showTitle?: boolean;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const [state, setState] = React.useState<"closed" | "open" | "opening">(
    "closed",
  );
  const [formKey, setFormKey] = React.useState(0);
  if (!comments.features.create) return null;
  if (
    !comments.isSessionPending &&
    !comments.commentLocked &&
    !comments.canComment
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col gap-3 rounded-2xl border p-4",
        className,
      )}
    >
      <h3 className={showTitle ? "font-semibold text-balance" : "sr-only"}>
        {t("compose.title")}
      </h3>
      {comments.isSessionPending ? (
        <Skeleton aria-hidden="true" className="h-12 w-full rounded-lg" />
      ) : comments.commentLocked ? (
        <ContentAccessRequired headingLevel="h3" kind="comment" />
      ) : state === "closed" ? (
        <Button
          className="text-muted-foreground h-auto justify-start py-3 font-normal"
          onClick={() => {
            setState("opening");
          }}
          onFocus={preloadContentCommentComposer}
          onPointerEnter={preloadContentCommentComposer}
          variant="outline"
        >
          <PencilIcon aria-hidden="true" />
          {t("compose.open")}
        </Button>
      ) : (
        <ContentCommentComposer
          autoFocus={state === "opening"}
          hideLabel={hideLabel}
          key={formKey}
          label={t("form.body_label")}
          mode="create"
          onCancel={() => {
            setState("closed");
          }}
          onDone={() => {
            setState("open");
            setFormKey(formKey + 1);
          }}
          parentId={null}
        />
      )}
    </div>
  );
};

/** A long thread shows its first and last conversations and folds the rest. */
const COLLAPSE_AFTER = 10;
const HEAD_COUNT = 5;
const TAIL_COUNT = 2;
const REVEAL_STEP = 10;

type CommentSort = "newest" | "oldest" | "top";

type PointTotals = ReadonlyMap<ContentId, number>;

const latestTime = (node: CommentTreeNode): number =>
  Math.max(nodeTime(node), ...node.children.map(latestTime));

const replyTotal = (node: CommentTreeNode): number =>
  node.children.reduce((sum, child) => sum + 1 + replyTotal(child), 0);

const sortConversations = (
  nodes: readonly CommentTreeNode[],
  sort: CommentSort,
  points: PointTotals,
) =>
  nodes.toSorted((a, b) => {
    if (sort === "oldest") return nodeTime(a) - nodeTime(b);
    if (sort === "top") {
      return (
        (points.get(b.id) ?? 0) - (points.get(a.id) ?? 0) ||
        replyTotal(b) - replyTotal(a) ||
        latestTime(b) - latestTime(a)
      );
    }

    return latestTime(b) - latestTime(a);
  });

/**
 * The order on screen. A conversation that arrives later (a new page, a live
 * update) joins at the end - or the top for `newest` - instead of reshuffling
 * what the reader is looking at; picking a sort orders everything again.
 */
const useStableOrder = (
  tree: readonly CommentTreeNode[],
  sort: CommentSort,
  points: PointTotals,
) => {
  const [order, setOrder] = React.useState<readonly ContentId[]>(() =>
    sortConversations(tree, sort, points).map(node => node.id),
  );
  const byId = new Map(tree.map(node => [node.id, node]));
  const known = new Set(order);
  const kept = order.flatMap(id => byId.get(id) ?? []);
  const fresh = sortConversations(
    tree.filter(node => !known.has(node.id)),
    sort,
    points,
  );
  const visible = sort === "newest" ? [...fresh, ...kept] : [...kept, ...fresh];
  if (fresh.length > 0) setOrder(visible.map(node => node.id));

  return {
    resort: (nextSort: CommentSort, nextPoints: PointTotals) => {
      setOrder(
        sortConversations(tree, nextSort, nextPoints).map(node => node.id),
      );
    },
    visible,
  };
};

/** Each top-level comment's points from reactions, read when **Most points** is picked. */
const usePointTotals = (tree: readonly CommentTreeNode[]) => {
  const queryClient = useQueryClient();
  const { comments } = useContentCommentsContext();

  return async (): Promise<PointTotals> => {
    const catalog = await queryClient
      .query(reactionsCatalogQueryOptions(comments.userId))
      .catch(() => null);
    const totals = await Promise.all(
      tree.map(async node => {
        const target = node.record ? comments.reactionTarget(node.id) : null;
        if (!target || !catalog) return [node.id, 0] as const;
        try {
          const summary = await queryClient.query(
            reactionSummaryQueryOptions(target, comments.userId),
          );

          return [node.id, reactionPoints(summary, catalog)] as const;
        } catch {
          return [node.id, 0] as const;
        }
      }),
    );

    return new Map<ContentId, number>(totals);
  };
};

const withViewTransition = (update: () => void) => {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("startViewTransition" in document)
  ) {
    update();

    return;
  }
  document.startViewTransition(() => {
    flushSync(update);
  });
};

/** `false` on the first paint, so comments already there don't animate in. */
const useAnimateEntries = () => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setReady(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return ready;
};

const Zigzag = () => {
  const patternId = React.useId();

  return (
    <svg
      aria-hidden="true"
      className="text-border h-2 min-w-0 flex-1"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          height="8"
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="12"
        >
          <path
            d="M0 6 L6 1.5 L12 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
          />
        </pattern>
      </defs>
      <rect fill={`url(#${patternId})`} height="100%" width="100%" />
    </svg>
  );
};

const HiddenConversations = ({
  count,
  onLoad,
}: {
  count: number;
  onLoad: () => void;
}) => {
  const t = useTranslations("core.comments");

  return (
    <div className="flex items-center gap-2 py-2">
      <Zigzag />
      <div className="bg-background flex shrink-0 flex-col items-center rounded-lg border px-6 py-2 text-center">
        <span className="text-muted-foreground text-sm tabular-nums">
          {t("gap.hidden", { count })}
        </span>
        <button
          className="text-primary focus-visible:ring-ring/50 rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          onClick={onLoad}
          type="button"
        >
          {t("gap.load")}
        </button>
      </div>
      <Zigzag />
    </div>
  );
};

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);

  return () => {
    window.removeEventListener("hashchange", onChange);
  };
};

const linksToComment = () =>
  window.location.hash.startsWith(`#${CONTENT_COMMENT_ANCHOR_PREFIX}`);

const ConversationRows = ({
  firstNewId,
  nodes,
}: {
  firstNewId: ContentId | undefined;
  nodes: readonly CommentTreeNode[];
}) =>
  nodes.map(node => (
    <React.Fragment key={String(node.id)}>
      {node.id === firstNewId ? <ContentCommentsNewSeparator /> : null}
      <ContentCommentCard node={node} />
    </React.Fragment>
  ));

const SORT_ICONS = {
  newest: ArrowDownWideNarrowIcon,
  oldest: ArrowUpNarrowWideIcon,
  top: TrendingUpIcon,
} as const;

const CommentList = ({ display }: { display: AnyDisplay }) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const tree = comments.tree as CommentTreeNode[];
  const [sort, setSort] = React.useState<CommentSort>("oldest");
  const [points, setPoints] = React.useState<PointTotals>(new Map());
  const { resort, visible } = useStableOrder(tree, sort, points);
  const [isRanking, setIsRanking] = React.useState(false);
  const loadPoints = usePointTotals(tree);
  const [revealed, setRevealed] = React.useState(0);
  const showAll = React.useSyncExternalStore(
    subscribeToHash,
    linksToComment,
    () => false,
  );

  const hiddenCount =
    !showAll && visible.length > COLLAPSE_AFTER
      ? Math.max(0, visible.length - HEAD_COUNT - TAIL_COUNT - revealed)
      : 0;
  const head =
    hiddenCount > 0 ? visible.slice(0, HEAD_COUNT + revealed) : visible;
  const tail = hiddenCount > 0 ? visible.slice(-TAIL_COUNT) : [];
  const newIdSet = new Set<ContentId>(comments.newCommentIds);
  const firstNewId = visible.find(node => newIdSet.has(node.id))?.id;

  const revealMore = () => {
    const firstRevealed = visible.at(head.length);
    setRevealed(current => current + REVEAL_STEP);
    const anchorId = firstRevealed
      ? commentAnchorIdOf(firstRevealed, display)
      : null;
    if (!anchorId) return;
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.focus();
    });
  };

  const pick = async (next: CommentSort) => {
    if (next === sort || isRanking) return;
    if (next !== "top") {
      withViewTransition(() => {
        setSort(next);
        resort(next, points);
        setRevealed(0);
      });

      return;
    }
    setIsRanking(true);
    try {
      const totals = await loadPoints();
      withViewTransition(() => {
        setPoints(totals);
        setSort("top");
        resort("top", totals);
        setRevealed(0);
      });
    } finally {
      setIsRanking(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {tree.length > 1 ? (
        <div className="flex justify-end">
          <ToggleGroup
            aria-label={t("sort.label")}
            onValueChange={next => {
              const picked = next[0] as CommentSort | undefined;
              if (picked) void pick(picked);
            }}
            value={[sort]}
            variant="outline"
          >
            {(["oldest", "newest", "top"] as const).map(item => {
              const Icon = SORT_ICONS[item];

              return (
                <ToggleGroupItem className="gap-1.5" key={item} value={item}>
                  <Icon aria-hidden="true" />
                  {t(`sort.${item}`)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </div>
      ) : null}
      <ol
        aria-busy={isRanking}
        className={cn(
          "flex flex-col gap-4 transition-opacity duration-150 ease-out motion-reduce:transition-none",
          isRanking && "opacity-60",
        )}
      >
        <ConversationRows firstNewId={firstNewId} nodes={head} />
      </ol>
      {hiddenCount > 0 ? (
        <>
          <HiddenConversations count={hiddenCount} onLoad={revealMore} />
          <ol className="flex flex-col gap-4">
            <ConversationRows firstNewId={firstNewId} nodes={tail} />
          </ol>
        </>
      ) : null}
    </div>
  );
};

const ContentCommentsSection = ({
  className,
  display,
  title,
}: {
  className?: string;
  display: AnyDisplay;
  title?: React.ReactNode;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const headingId = React.useId();
  const animateEntries = useAnimateEntries();
  const [postedReplyId, setPostedReplyId] = React.useState<ContentId | null>(
    null,
  );
  const authorIds = React.useMemo(
    () => new Set(display.authorIds ?? []),
    [display.authorIds],
  );
  const anchor = useRevealHashTarget({
    hasMore: comments.hasMore,
    isLoadingMore: comments.isLoadingMore,
    loadMore: comments.loadMore,
    prefix: CONTENT_COMMENT_ANCHOR_PREFIX,
    ready: comments.status === "success",
    renderedCount: comments.items.length,
  });
  const highlightedId = anchor.status === "found" ? anchor.targetId : null;
  const thread = React.useMemo<CardThreadContextValue>(
    () => ({
      animateEntries,
      authorIds,
      display,
      highlightedId,
      postedReplyId,
      setPostedReplyId,
      signedIn: comments.userId !== null,
    }),
    [
      animateEntries,
      authorIds,
      comments.userId,
      display,
      highlightedId,
      postedReplyId,
    ],
  );

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-6", className)}
      id="comments"
    >
      <CardThreadContext value={thread}>
        <h2
          className="text-foreground flex items-center gap-2 text-2xl font-semibold tracking-tight text-balance"
          id={headingId}
        >
          <MessageSquareIcon
            aria-hidden="true"
            className="text-muted-foreground size-5"
          />
          {title ?? t("title", { count: comments.replyCount })}
        </h2>

        {comments.status === "pending" ? (
          <CommentsSkeleton label={t("loading")} />
        ) : comments.status === "error" ? (
          <Empty className="border" role="alert">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquareWarningIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle render={<h3 />}>{t("load_failed.title")}</EmptyTitle>
              <EmptyDescription>{t("load_failed.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                isLoading={comments.isRefreshing}
                onClick={() => {
                  void comments.retry();
                }}
                variant="outline"
              >
                <RotateCwIcon aria-hidden="true" />
                {t("load_failed.retry")}
              </Button>
            </EmptyContent>
          </Empty>
        ) : comments.tree.length === 0 ? (
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
          <div aria-busy={comments.isRefreshing}>
            <CommentList display={display} />
          </div>
        )}

        {anchor.status === "missing" ? (
          <p
            className="text-muted-foreground text-sm leading-relaxed"
            role="status"
          >
            {t("anchor_missing")}
          </p>
        ) : null}
        {comments.truncated ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("truncated")}
          </p>
        ) : null}
        <ContentCommentsLiveStatus />
        <ContentCommentsLoadMore />
        <ContentCommentsComposer hideLabel showTitle={false} />
      </CardThreadContext>
    </section>
  );
};

/**
 * A complete comment section for one Content Engine record, the same in every
 * plugin: each top-level comment is a card with its replies below it in the
 * order written, each naming whom it answers, and a reply field at the bottom.
 * Comments carry reactions, **Quote**, **Share**, the actions menu and, with
 * `history`, an "edited" link to the edit history. The reader sorts by
 * Oldest, Newest or Most points (reaction points); long threads fold their
 * middle conversations. Below: load more, live status and the composer or a
 * sign-in link. Scrolls to and rings the comment a `#comment-...` link points
 * to, loading more pages until it appears.
 *
 * For your own layout, use `ContentCommentsRoot` with `ContentCommentItem`,
 * `ContentCommentActions` and `ContentCommentComposer` instead.
 *
 * @example
 * ```tsx
 * <ContentComments
 *   anchorKey={comment => comment.slug}
 *   authorIds={[article.author.id]}
 *   comments={comments}
 *   permalink={anchorId => `/blog/${article.slug}#${anchorId}`}
 *   shareTitle={article.title}
 * />
 * ```
 */
export const ContentComments = <TRecord, TId extends ContentId>({
  className,
  comments,
  title,
  ...display
}: ContentCommentsDisplay<TRecord> & {
  className?: string;
  /** From `useContentComments`. */
  comments: ContentCommentsController<TRecord, TId>;
  /** Replaces the "N comments" heading. */
  title?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

  return (
    <ContentCommentsRoot
      comments={comments}
      fallback={<CommentsSkeleton label={t("loading")} />}
    >
      <ContentCommentsSection
        className={className}
        display={display as AnyDisplay}
        title={title}
      />
    </ContentCommentsRoot>
  );
};
