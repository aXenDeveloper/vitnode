import type { ContentTarget } from "@vitnode/core/content";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@vitnode/core/components/ui/toggle-group";
import { useRevealHashTarget } from "@vitnode/core/hooks/use-reveal-hash-target";
import {
  CONTENT_COMMENT_ANCHOR_PREFIX,
  ContentCommentsComposer,
  ContentCommentsLiveStatus,
  ContentCommentsLoadMore,
  ContentCommentsRoot,
} from "@vitnode/core/tanstack/comments";
import { reactionSummaryQueryOptions } from "@vitnode/core/tanstack/reactions";
import { cn } from "cn";
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  RotateCwIcon,
  TrendingUpIcon,
} from "lucide-react";
import React from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "use-intl";

import type {
  CommentTreeNode,
  ThreadContextValue,
} from "./post-comment-thread";

import { CommentThread, nodeTime, ThreadContext } from "./post-comment-thread";
import { commentAnchorId, usePostComments } from "./post-comments-data";

const COLLAPSE_AFTER = 10;
const HEAD_COUNT = 5;
const TAIL_COUNT = 2;
const REVEAL_STEP = 10;
type Sort = "newest" | "oldest" | "top";

const SKELETON_KEYS = ["first", "second", "third"];

const CommentsPendingSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-4">
    <span className="sr-only" role="status">
      {label}
    </span>
    {SKELETON_KEYS.map(key => (
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

const latestTime = (node: CommentTreeNode): number =>
  Math.max(nodeTime(node), ...node.children.map(latestTime));

const replyTotal = (node: CommentTreeNode): number =>
  node.children.reduce((sum, child) => sum + 1 + replyTotal(child), 0);

type ReactionTotals = ReadonlyMap<CommentTreeNode["id"], number>;

const sortConversations = (
  nodes: readonly CommentTreeNode[],
  sort: Sort,
  reactionTotals: ReactionTotals,
) =>
  nodes.toSorted((a, b) => {
    if (sort === "oldest") return nodeTime(a) - nodeTime(b);
    if (sort === "top") {
      return (
        (reactionTotals.get(b.id) ?? 0) - (reactionTotals.get(a.id) ?? 0) ||
        replyTotal(b) - replyTotal(a) ||
        latestTime(b) - latestTime(a)
      );
    }

    return latestTime(b) - latestTime(a);
  });

const useStableOrder = (
  tree: readonly CommentTreeNode[],
  sort: Sort,
  reactionTotals: ReactionTotals,
) => {
  const [order, setOrder] = React.useState<readonly CommentTreeNode["id"][]>(
    () => sortConversations(tree, sort, reactionTotals).map(node => node.id),
  );
  const byId = new Map(tree.map(node => [node.id, node]));
  const known = new Set(order);
  const kept = order.flatMap(id => byId.get(id) ?? []);
  const fresh = sortConversations(
    tree.filter(node => !known.has(node.id)),
    sort,
    reactionTotals,
  );
  const visible = sort === "newest" ? [...fresh, ...kept] : [...kept, ...fresh];
  if (fresh.length > 0) setOrder(visible.map(node => node.id));

  return {
    resort: (nextSort: Sort, nextTotals: ReactionTotals) => {
      setOrder(
        sortConversations(tree, nextSort, nextTotals).map(node => node.id),
      );
    },
    visible,
  };
};

const useReactionTotals = ({
  reactionTarget,
  tree,
  viewerId,
}: {
  reactionTarget: (id: number) => ContentTarget | null;
  tree: readonly CommentTreeNode[];
  viewerId: null | number;
}) => {
  const queryClient = useQueryClient();

  return async () => {
    const totals = await Promise.all(
      tree.map(async node => {
        const target = node.record ? reactionTarget(node.record.id) : null;
        if (!target) return [node.id, 0] as const;
        try {
          const summary = await queryClient.query(
            reactionSummaryQueryOptions(target, viewerId),
          );

          return [node.id, summary.total] as const;
        } catch {
          return [node.id, 0] as const;
        }
      }),
    );

    return new Map<CommentTreeNode["id"], number>(totals);
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
  const t = useTranslations("@vitnode/blog.comments");

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

const CommentList = ({
  reactionTarget,
  tree,
  viewerId,
}: {
  reactionTarget: (id: number) => ContentTarget | null;
  tree: readonly CommentTreeNode[];
  viewerId: null | number;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const [sort, setSort] = React.useState<Sort>("oldest");
  const [reactionTotals, setReactionTotals] = React.useState<ReactionTotals>(
    new Map(),
  );
  const { resort, visible } = useStableOrder(tree, sort, reactionTotals);
  const [isRanking, setIsRanking] = React.useState(false);
  const loadReactionTotals = useReactionTotals({
    reactionTarget,
    tree,
    viewerId,
  });
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

  const revealMore = () => {
    const firstNew = visible[head.length]?.record;
    setRevealed(current => current + REVEAL_STEP);
    if (!firstNew) return;
    requestAnimationFrame(() => {
      document.getElementById(commentAnchorId(firstNew.slug))?.focus();
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex justify-end">
        <ToggleGroup
          aria-label={t("sort.label")}
          onValueChange={async next => {
            const picked = next[0] as Sort | undefined;
            if (!picked || picked === sort || isRanking) return;
            if (picked !== "top") {
              withViewTransition(() => {
                setSort(picked);
                resort(picked, reactionTotals);
                setRevealed(0);
              });

              return;
            }
            setIsRanking(true);
            try {
              const totals = await loadReactionTotals();
              withViewTransition(() => {
                setReactionTotals(totals);
                setSort("top");
                resort("top", totals);
                setRevealed(0);
              });
            } finally {
              setIsRanking(false);
            }
          }}
          value={[sort]}
          variant="outline"
        >
          <ToggleGroupItem className="gap-1.5" value="oldest">
            <ArrowUpNarrowWideIcon aria-hidden="true" />
            {t("sort.oldest")}
          </ToggleGroupItem>
          <ToggleGroupItem className="gap-1.5" value="newest">
            <ArrowDownWideNarrowIcon aria-hidden="true" />
            {t("sort.newest")}
          </ToggleGroupItem>
          <ToggleGroupItem className="gap-1.5" value="top">
            <TrendingUpIcon aria-hidden="true" />
            {t("sort.top")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ol
        aria-busy={isRanking}
        className={cn(
          "flex flex-col gap-4 transition-opacity duration-150 ease-out motion-reduce:transition-none",
          isRanking && "opacity-60",
        )}
      >
        {head.map(node => (
          <CommentThread key={node.id} node={node} />
        ))}
      </ol>
      {hiddenCount > 0 ? (
        <>
          <HiddenConversations count={hiddenCount} onLoad={revealMore} />
          <ol className="flex flex-col gap-4">
            {tail.map(node => (
              <CommentThread key={node.id} node={node} />
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
};

const PostCommentsThread = ({
  articleAuthorIds,
  articleHref,
  articleTitle,
  comments,
}: {
  articleAuthorIds: readonly number[];
  articleHref: string;
  articleTitle: string;
  comments: ReturnType<typeof usePostComments>;
}) => {
  const t = useTranslations("core.comments");
  const animateEntries = useAnimateEntries();
  const [postedReplyId, setPostedReplyId] = React.useState<null | number>(null);
  const authorIdSet = React.useMemo(
    () => new Set(articleAuthorIds),
    [articleAuthorIds],
  );
  const anchor = useRevealHashTarget({
    hasMore: comments.hasMore,
    isLoadingMore: comments.isLoadingMore,
    loadMore: comments.loadMore,
    prefix: CONTENT_COMMENT_ANCHOR_PREFIX,
    ready: comments.status === "success",
    renderedCount: comments.items.length,
  });
  const thread = React.useMemo<ThreadContextValue>(
    () => ({
      animateEntries,
      articleAuthorIds: authorIdSet,
      articleHref,
      articleTitle,
      highlightedId: anchor.status === "found" ? anchor.targetId : null,
      postedReplyId,
      setPostedReplyId,
      signedIn: comments.userId !== null,
    }),
    [
      anchor.status,
      anchor.targetId,
      animateEntries,
      articleHref,
      articleTitle,
      authorIdSet,
      comments.userId,
      postedReplyId,
    ],
  );

  return (
    <ThreadContext value={thread}>
      <h2
        className="text-foreground flex items-center gap-2 text-2xl font-semibold tracking-tight text-balance"
        id="blog-comments"
      >
        <MessageSquareIcon
          aria-hidden="true"
          className="text-muted-foreground size-5"
        />
        {t("title", { count: comments.replyCount })}
      </h2>

      {comments.status === "pending" ? (
        <CommentsPendingSkeleton label={t("loading")} />
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
          <CommentList
            reactionTarget={comments.reactionTarget}
            tree={comments.tree}
            viewerId={comments.userId}
          />
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
    </ThreadContext>
  );
};

export const PostComments = ({
  articleAuthorIds,
  articleHref,
  articleId,
  articleTitle,
  canComment = true,
}: {
  articleAuthorIds: readonly number[];
  articleHref: string;
  articleId: number;
  articleTitle: string;
  /** Whether the article's categories let this reader comment. */
  canComment?: boolean;
}) => {
  const t = useTranslations("core.global");
  const comments = usePostComments(articleId, canComment);

  return (
    <section
      aria-labelledby="blog-comments"
      className="flex flex-col gap-6"
      id="comments"
    >
      <ContentCommentsRoot
        comments={comments}
        fallback={<CommentsPendingSkeleton label={t("loading")} />}
      >
        <PostCommentsThread
          articleAuthorIds={articleAuthorIds}
          articleHref={articleHref}
          articleTitle={articleTitle}
          comments={comments}
        />
      </ContentCommentsRoot>
    </section>
  );
};
