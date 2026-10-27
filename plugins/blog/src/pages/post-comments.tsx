import { Avatar } from "@vitnode/core/components/avatar";
import { DateFormat } from "@vitnode/core/components/date-format";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { SharePopover } from "@vitnode/core/components/share-popover";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vitnode/core/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { UserFormat } from "@vitnode/core/components/user-format";
import { useRevealHashTarget } from "@vitnode/core/hooks/use-reveal-hash-target";
import {
  CONTENT_COMMENT_ANCHOR_PREFIX,
  ContentCommentActions,
  contentCommentAuthorName,
  ContentCommentComposer,
  ContentCommentPlaceholder,
  ContentCommentsComposer,
  ContentCommentsLoadMore,
  ContentCommentsRoot,
  type ContentCommentTreeNode,
  preloadContentCommentComposer,
  useContentCommentItem,
} from "@vitnode/core/tanstack/comments";
import { cn } from "cn";
import {
  ChevronDownIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CornerDownRightIcon,
  EyeOffIcon,
  MessageSquareIcon,
  PencilIcon,
  PenLineIcon,
  ReplyIcon,
  RotateCwIcon,
  Share2Icon,
  UserRoundIcon,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslations } from "use-intl";

import type { PostComment } from "./post-comments-data";

import { commentAnchorId, usePostComments } from "./post-comments-data";

const EDITED_AFTER_MS = 60_000;

const COMMENT_ACTION_CLASS = "text-muted-foreground font-semibold";

type CommentPerson = PostComment["author"];

type CommentTreeNode = ContentCommentTreeNode<PostComment, number>;

const AVATAR_SIZE_CLASS = { 24: "size-6", 32: "size-8" };

const CommentAvatar = ({
  className,
  person,
  size = 32,
}: {
  className?: string;
  person: CommentPerson;
  size?: keyof typeof AVATAR_SIZE_CLASS;
}) =>
  person ? (
    <Avatar
      alt=""
      className={cn("shrink-0", AVATAR_SIZE_CLASS[size], className)}
      size={size}
      user={person}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "bg-muted shrink-0 rounded-full",
        AVATAR_SIZE_CLASS[size],
        className,
      )}
    />
  );

const CommentAuthor = ({
  id,
  person,
}: {
  id: string;
  person: CommentPerson;
}) => {
  const t = useTranslations("core.comments");

  return person ? (
    <UserFormat
      className="text-foreground min-w-0 truncate"
      format
      id={id}
      link
      user={person}
    />
  ) : (
    <span
      className="text-muted-foreground min-w-0 truncate font-medium"
      id={id}
    >
      {t("deleted_user")}
    </span>
  );
};

const RailMarker = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "bg-background text-muted-foreground relative flex size-8 shrink-0 items-center justify-center rounded-full border [&_svg]:size-4",
      className,
    )}
  >
    {children}
  </span>
);

interface ThreadActions {
  articleAuthorIds: ReadonlySet<number>;
  articleHref: string;
  articleTitle: string;
  currentUserId: null | number;
  hashTargetId: null | string;
  highlightedId: null | string;
}

const countReplies = (node: CommentTreeNode): number =>
  node.children.reduce((total, child) => total + 1 + countReplies(child), 0);

const repliesInclude = (node: CommentTreeNode, anchorId: string): boolean =>
  node.children.some(
    child =>
      (child.record !== null &&
        commentAnchorId(child.record.slug) === anchorId) ||
      repliesInclude(child, anchorId),
  );

const CommentEntry = ({
  actions,
  comment,
  node,
  replies,
}: {
  actions: ThreadActions;
  comment: PostComment;
  node: CommentTreeNode;
  replies?: RepliesState;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const tc = useTranslations("core.comments");
  const item = useContentCommentItem(node);
  const isHidden = node.hidden;
  const anchorId = commentAnchorId(comment.slug);
  const authorId = `${anchorId}-author`;
  const authorName =
    contentCommentAuthorName(comment.author) ?? tc("deleted_user");
  // Styling only: what the visitor may do always comes from the server.
  const isOwn =
    actions.currentUserId !== null &&
    comment.author?.id === actions.currentUserId;
  const isEdited =
    comment.publishedAt !== null &&
    new Date(comment.updatedAt).getTime() -
      new Date(comment.publishedAt).getTime() >
      EDITED_AFTER_MS;
  const date = comment.publishedAt ?? comment.createdAt;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      {item.editing ? (
        <ContentCommentComposer
          autoFocus
          editable={item.editing}
          id={comment.id}
          label={tc("form.edit_label")}
          mode="edit"
          onCancel={item.stopEditing}
          onDone={item.stopEditing}
        />
      ) : (
        <article
          aria-labelledby={authorId}
          className={cn(
            "flex w-fit max-w-full min-w-0 flex-col gap-0.5 rounded-2xl rounded-ss-sm px-4 py-2.5",
            isHidden
              ? "bg-muted/40 border border-dashed"
              : cn(
                  "bg-card text-card-foreground border",
                  isOwn && "border-primary/40",
                ),
            anchorId === actions.highlightedId && "ring-primary/50 ring-2",
          )}
        >
          <header className="flex min-w-0 items-center gap-1.5 text-sm leading-relaxed">
            <CommentAuthor id={authorId} person={comment.author} />
            {comment.author &&
            actions.articleAuthorIds.has(comment.author.id) ? (
              <Badge
                className="border-primary/20 bg-primary/10 text-primary max-sm:px-1"
                title={t("article_author")}
                variant="outline"
              >
                <PenLineIcon aria-hidden="true" />
                <span className="max-sm:sr-only">{t("article_author")}</span>
              </Badge>
            ) : null}
            <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap">
              <span aria-hidden="true">·</span>
              <a
                className="hover:text-foreground rounded-sm tabular-nums hover:underline"
                href={`${actions.articleHref}#${anchorId}`}
              >
                <time dateTime={new Date(date).toISOString()}>
                  <DateFormat date={date} />
                </time>
                <span className="sr-only"> {tc("permalink")}</span>
              </a>
              {isEdited ? <span>· {tc("edited_label")}</span> : null}
              {isHidden ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  · <EyeOffIcon aria-hidden="true" className="size-3.5" />
                  {tc("visibility.hidden_label")}
                </span>
              ) : null}
            </span>
          </header>
          <RichTextContent
            className={cn(
              "leading-relaxed text-pretty",
              isHidden ? "text-muted-foreground" : "text-foreground",
            )}
            content={comment.body}
          />
          {isHidden && node.hiddenReason ? (
            <p className="text-muted-foreground border-t border-dashed pt-1.5 text-sm leading-relaxed text-pretty">
              {tc("visibility.hidden_reason", { reason: node.hiddenReason })}
            </p>
          ) : null}
        </article>
      )}

      {item.editing ? null : (
        <div className="flex flex-wrap items-center gap-x-1 ps-2">
          {item.canReply ? (
            <Button
              aria-expanded={item.isReplying}
              className={COMMENT_ACTION_CLASS}
              onClick={() => {
                item.setIsReplying(!item.isReplying);
              }}
              onFocus={preloadContentCommentComposer}
              onPointerEnter={preloadContentCommentComposer}
              size="xs"
              variant="ghost"
            >
              <ReplyIcon aria-hidden="true" />
              {tc("reply")}
            </Button>
          ) : null}
          {isHidden ? null : (
            <SharePopover
              description={t("share.description", { name: authorName })}
              title={actions.articleTitle}
              url={`${actions.articleHref}#${anchorId}`}
            >
              <Button
                aria-describedby={authorId}
                className={COMMENT_ACTION_CLASS}
                size="xs"
                variant="ghost"
              >
                <Share2Icon aria-hidden="true" />
                {t("share.label")}
              </Button>
            </SharePopover>
          )}
          <ContentCommentActions item={item} node={node} />
          {replies && !replies.open ? (
            <Button
              className={COMMENT_ACTION_CLASS}
              onClick={() => {
                replies.onOpenChange(true);
              }}
              size="xs"
              variant="ghost"
            >
              <ChevronDownIcon aria-hidden="true" />
              {tc("show_replies", { count: replies.count })}
            </Button>
          ) : null}
        </div>
      )}

      {item.isReplying ? (
        <div className="pt-2">
          <ContentCommentComposer
            autoFocus
            label={tc("form.answer_label", {
              name: contentCommentAuthorName(comment.author) ?? tc("someone"),
            })}
            mode="create"
            onCancel={() => {
              item.setIsReplying(false);
            }}
            onDone={() => {
              item.setIsReplying(false);
            }}
            parentId={comment.id}
          />
        </div>
      ) : null}
    </div>
  );
};

const INDENT_UNTIL_DEPTH = { desktop: 4, mobile: 2 };

type ReplyFlattening = "always" | "mobile" | null;

type CommentLevel = "nested" | "top";

const flatteningBelow = (parentDepth: number): ReplyFlattening => {
  if (parentDepth >= INDENT_UNTIL_DEPTH.desktop) return "always";
  if (parentDepth >= INDENT_UNTIL_DEPTH.mobile) return "mobile";

  return null;
};

const ELBOW = {
  nested: "before:-start-5 before:w-5 after:-start-5",
  top: "before:-start-7 before:w-7 after:-start-7",
};

const THREAD_CONNECTOR =
  "before:border-border after:border-border relative isolate before:pointer-events-none before:absolute before:-z-10 after:-z-10 before:top-0 before:-translate-x-px before:border-s-2 after:pointer-events-none after:absolute after:top-0 after:bottom-0 after:-translate-x-px after:border-s-2 last:after:hidden rtl:before:translate-x-px rtl:after:translate-x-px";

const CURVED = "before:h-7 before:rounded-es-xl before:border-b-2";

const STRAIGHT = "before:start-3 before:h-9 after:start-3";

const STRAIGHT_ON_MOBILE =
  "max-md:before:start-3 max-md:before:h-9 max-md:before:w-auto max-md:before:rounded-none max-md:before:border-b-0 max-md:after:start-3";

const elbowClass = (
  parentLevel: CommentLevel,
  flattening: ReplyFlattening,
): string =>
  flattening === "always"
    ? cn(THREAD_CONNECTOR, STRAIGHT)
    : cn(
        THREAD_CONNECTOR,
        CURVED,
        ELBOW[parentLevel],
        flattening === "mobile" && STRAIGHT_ON_MOBILE,
      );

interface RepliesState {
  count: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const ReplyingTo = ({
  flattening,
  name,
}: {
  flattening: ReplyFlattening;
  name: string;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  if (!flattening) return null;

  return (
    <p
      className={cn(
        "text-muted-foreground flex min-w-0 items-center gap-1.5 ps-2 pb-1 text-xs",
        flattening === "mobile" && "md:hidden",
      )}
    >
      <CornerDownRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{t("replying_to", { name })}</span>
    </p>
  );
};

const RepliesToggle = ({ count, open }: { count: number; open: boolean }) => {
  const t = useTranslations("core.comments");
  const Icon = open ? CircleMinusIcon : CirclePlusIcon;

  return (
    <CollapsibleTrigger
      aria-label={
        open ? t("hide_replies", { count }) : t("show_replies", { count })
      }
      className="bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 relative mb-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 ease-out outline-none focus-visible:ring-3"
    >
      <Icon aria-hidden="true" className="size-5" />
    </CollapsibleTrigger>
  );
};

const CommentBranch = ({
  actions,
  avatar,
  entry,
  level,
  node,
}: {
  actions: ThreadActions;
  avatar: React.ReactNode;
  entry: (replies: RepliesState | undefined) => React.ReactNode;
  level: CommentLevel;
  node: CommentTreeNode;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const tc = useTranslations("core.comments");
  const holdsHashTarget = useMemo(
    () =>
      actions.hashTargetId !== null &&
      repliesInclude(node, actions.hashTargetId),
    [actions.hashTargetId, node],
  );
  const [open, setOpen] = useState(
    holdsHashTarget || (!node.removed && !node.hidden),
  );
  const [revealedHashTarget, setRevealedHashTarget] = useState(holdsHashTarget);
  if (holdsHashTarget !== revealedHashTarget) {
    setRevealedHashTarget(holdsHashTarget);
    if (holdsHashTarget) setOpen(true);
  }
  const count = useMemo(() => countReplies(node), [node]);
  const hasReplies = node.children.length > 0;
  const flattening = flatteningBelow(node.depth);
  const parentName = node.record
    ? (contentCommentAuthorName(node.record.author) ?? tc("deleted_user"))
    : t("removed_comment");

  const row = (
    <div className={cn("flex", level === "top" ? "gap-3" : "gap-2")}>
      <div className="flex shrink-0 flex-col items-center">
        {avatar}
        {hasReplies ? (
          <>
            <span aria-hidden="true" className="bg-border w-0.5 flex-1" />
            <RepliesToggle count={count} open={open} />
          </>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {entry(hasReplies ? { count, onOpenChange: setOpen, open } : undefined)}
      </div>
    </div>
  );

  if (!hasReplies) return row;

  return (
    <Collapsible onOpenChange={setOpen} open={open}>
      {row}
      <CollapsibleContent
        className="ease-fluid h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-[opacity]"
        keepMounted
      >
        <ol
          className={cn(
            "flex flex-col",
            level === "top" ? "ms-11" : "ms-8",
            flattening === "always" && "ms-0",
            flattening === "mobile" && "max-md:ms-0",
          )}
        >
          {node.children.map(child => (
            <ReplyNodeView
              actions={actions}
              flattening={flattening}
              key={child.id}
              node={child}
              parentLevel={level}
              parentName={parentName}
            />
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
};

const RemovedEntry = ({
  node,
  replies,
}: {
  node: CommentTreeNode;
  replies?: RepliesState;
}) => {
  const t = useTranslations("core.comments");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <ContentCommentPlaceholder node={node} />
      {replies ? (
        <div className="flex flex-wrap items-center gap-x-1 ps-2">
          <Button
            aria-expanded={replies.open}
            className={COMMENT_ACTION_CLASS}
            onClick={() => {
              replies.onOpenChange(!replies.open);
            }}
            size="xs"
            variant="ghost"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "ease-fluid transition-transform duration-200 motion-reduce:transition-none",
                replies.open && "rotate-180",
              )}
            />
            {replies.open
              ? t("hide_replies", { count: replies.count })
              : t("show_replies", { count: replies.count })}
          </Button>
        </div>
      ) : null}
    </div>
  );
};

const ReplyNodeView = memo(
  ({
    actions,
    flattening,
    node,
    parentLevel,
    parentName,
  }: {
    actions: ThreadActions;
    flattening: ReplyFlattening;
    node: CommentTreeNode;
    parentLevel: CommentLevel;
    parentName: string;
  }) => {
    const avatarOffset = cn(
      "mt-1",
      flattening === "always" && "mt-6",
      flattening === "mobile" && "max-md:mt-6",
    );

    return (
      <li
        className={cn(
          "scroll-mt-24 pt-3 outline-none",
          elbowClass(parentLevel, flattening),
        )}
        id={node.record ? commentAnchorId(node.record.slug) : undefined}
        tabIndex={node.record ? -1 : undefined}
      >
        <CommentBranch
          actions={actions}
          avatar={
            node.record ? (
              <CommentAvatar
                className={avatarOffset}
                person={node.record.author}
                size={24}
              />
            ) : (
              <RailMarker className={cn("size-6", avatarOffset)}>
                <UserRoundIcon className="size-3.5!" />
              </RailMarker>
            )
          }
          entry={replies => (
            <>
              <ReplyingTo flattening={flattening} name={parentName} />
              {node.record ? (
                <CommentEntry
                  actions={actions}
                  comment={node.record}
                  node={node}
                  replies={replies}
                />
              ) : (
                <RemovedEntry node={node} replies={replies} />
              )}
            </>
          )}
          level="nested"
          node={node}
        />
      </li>
    );
  },
);

const ThreadNodeView = memo(
  ({ actions, node }: { actions: ThreadActions; node: CommentTreeNode }) => {
    return (
      <li
        className="scroll-mt-24 outline-none"
        id={node.record ? commentAnchorId(node.record.slug) : undefined}
        tabIndex={node.record ? -1 : undefined}
      >
        <CommentBranch
          actions={actions}
          avatar={
            node.record ? (
              <CommentAvatar person={node.record.author} />
            ) : (
              <RailMarker>
                <UserRoundIcon />
              </RailMarker>
            )
          }
          entry={replies =>
            node.record ? (
              <CommentEntry
                actions={actions}
                comment={node.record}
                node={node}
                replies={replies}
              />
            ) : (
              <RemovedEntry node={node} replies={replies} />
            )
          }
          level="top"
          node={node}
        />
      </li>
    );
  },
);

const COMMENT_SKELETON_KEYS = ["first", "second", "third"];

const CommentsPendingSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-6">
    <span className="sr-only" role="status">
      {label}
    </span>
    {COMMENT_SKELETON_KEYS.map(key => (
      <div aria-hidden="true" className="flex items-start gap-3" key={key}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex w-full max-w-md flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-2xl rounded-ss-sm" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    ))}
  </div>
);

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
  const authorIdSet = useMemo(
    () => new Set(articleAuthorIds),
    [articleAuthorIds],
  );
  const { tree } = comments;

  const anchor = useRevealHashTarget({
    hasMore: comments.hasMore,
    isLoadingMore: comments.isLoadingMore,
    loadMore: comments.loadMore,
    prefix: CONTENT_COMMENT_ANCHOR_PREFIX,
    ready: comments.status === "success",
    renderedCount: comments.items.length,
  });
  const highlightedId = anchor.status === "found" ? anchor.targetId : null;

  const actions = useMemo<ThreadActions>(
    () => ({
      articleAuthorIds: authorIdSet,
      articleHref,
      articleTitle,
      currentUserId: comments.userId,
      hashTargetId: anchor.targetId,
      highlightedId,
    }),
    [
      anchor.targetId,
      authorIdSet,
      articleHref,
      articleTitle,
      comments.userId,
      highlightedId,
    ],
  );

  return (
    <>
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
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("load_failed.title")}. {t("load_failed.desc")}
          </p>
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
        </div>
      ) : tree.length === 0 ? (
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
        <ol aria-busy={comments.isRefreshing} className="flex flex-col gap-6">
          {tree.map(node => (
            <ThreadNodeView actions={actions} key={node.id} node={node} />
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

      {comments.truncated ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("truncated")}
        </p>
      ) : null}

      <ContentCommentsLoadMore />

      <div className="flex items-start gap-3">
        <RailMarker>
          <PencilIcon />
        </RailMarker>
        <ContentCommentsComposer className="flex-1 rounded-ss-sm" />
      </div>
    </>
  );
};

export const PostComments = ({
  articleAuthorIds,
  articleHref,
  articleId,
  articleTitle,
}: {
  articleAuthorIds: readonly number[];
  articleHref: string;
  articleId: number;
  articleTitle: string;
}) => {
  const t = useTranslations("core.global");
  const comments = usePostComments(articleId);

  return (
    <section
      aria-labelledby="blog-comments"
      className="flex flex-col gap-6 border-t pt-10"
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
