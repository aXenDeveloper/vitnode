import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { Avatar } from "@vitnode/core/components/avatar";
import { DateFormat } from "@vitnode/core/components/date-format";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { SharePopover } from "@vitnode/core/components/share-popover";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
} from "@vitnode/core/components/ui/collapsible";
import { SlidingNumber } from "@vitnode/core/components/ui/sliding-number";
import {
  TooltipGroup,
  TooltipGroupTrigger,
} from "@vitnode/core/components/ui/tooltip";
import { UserFormat } from "@vitnode/core/components/user-format";
import { UserPreview } from "@vitnode/core/components/user-preview";
import {
  AutoTranslateNote,
  useAutoTranslation,
} from "@vitnode/core/tanstack/auto-translate";
import {
  ContentCommentActions,
  contentCommentAuthorName,
  ContentCommentComposer,
  type ContentCommentTreeNode,
  preloadContentCommentComposer,
  useContentCommentItem,
} from "@vitnode/core/tanstack/comments";
import { ReactionBar } from "@vitnode/core/tanstack/reactions";
import { cn } from "cn";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  EyeOffIcon,
  QuoteIcon,
  ReplyIcon,
  Share2Icon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { blogCommentContentType } from "@/content/comment";

import type { PostComment } from "./post-comments-data";

import { CommentEdits } from "./post-comment-edits";
import { commentAnchorId } from "./post-comments-data";

export type CommentTreeNode = ContentCommentTreeNode<PostComment, number>;

export interface ThreadContextValue {
  animateEntries: boolean;
  articleAuthorIds: ReadonlySet<number>;
  articleHref: string;
  articleTitle: string;
  highlightedId: null | string;
  postedReplyId: null | number;
  setPostedReplyId: (id: null | number) => void;
  signedIn: boolean;
}

export const ThreadContext = React.createContext<null | ThreadContextValue>(
  null,
);

const useThread = () => {
  const thread = React.use(ThreadContext);
  if (!thread) throw new Error("useThread must be used inside ThreadContext");

  return thread;
};

const ENTER_CLASS =
  "ease-fluid transition-[opacity,translate] duration-200 starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none";

const COLLAPSIBLE_PANEL_CLASS =
  "ease-fluid h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-[opacity]";

export const nodeTime = (node: CommentTreeNode) =>
  node.record
    ? new Date(node.record.publishedAt ?? node.record.createdAt).getTime()
    : 0;

export const flattenReplies = (
  node: CommentTreeNode,
): { node: CommentTreeNode; parent: CommentTreeNode }[] =>
  node.children.flatMap(child => [
    { node: child, parent: node },
    ...flattenReplies(child),
  ]);

const useEntry = (node: CommentTreeNode) => {
  const thread = useThread();
  const tc = useTranslations("core.comments");
  const item = useContentCommentItem(node);
  const comment = node.record;
  const anchorId = comment ? commentAnchorId(comment.slug) : null;

  return {
    anchorId,
    authorId: anchorId ? `${anchorId}-author` : undefined,
    authorName: comment
      ? (contentCommentAuthorName(comment.author) ?? tc("deleted_user"))
      : tc("deleted_user"),
    comment,
    isArticleAuthor:
      !!comment?.author && thread.articleAuthorIds.has(comment.author.id),
    isHighlighted: anchorId !== null && anchorId === thread.highlightedId,
    item,
    node,
    thread,
  };
};

type Entry = ReturnType<typeof useEntry>;

const usePostedReplyRef = (entry: Entry) => {
  const { comment, thread } = entry;
  const posted = comment !== null && comment.id === thread.postedReplyId;

  return React.useCallback(
    (element: HTMLLIElement | null) => {
      if (!posted || !element) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      element.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
      });
      element.focus({ preventScroll: true });
      thread.setPostedReplyId(null);
    },
    [posted, thread],
  );
};

const anchorProps = (node: CommentTreeNode, className?: string) => ({
  className: cn("scroll-mt-24 outline-none", className),
  id: node.record ? commentAnchorId(node.record.slug) : undefined,
  tabIndex: node.record ? -1 : undefined,
});

const CommentAvatar = ({ node }: { node: CommentTreeNode }) =>
  node.record?.author ? (
    <UserPreview
      className="shrink-0 rounded-full"
      decorative
      nameCode={node.record.author.nameCode}
    >
      <Avatar alt="" className="size-8" size={32} user={node.record.author} />
    </UserPreview>
  ) : (
    <span
      aria-hidden="true"
      className="bg-muted size-8 shrink-0 rounded-full"
    />
  );

interface Quote {
  body: RichTextDocument;
  key: number;
}

const selectedLines = (container: Element | null) => {
  const selection = window.getSelection();
  if (
    !container ||
    !selection ||
    selection.isCollapsed ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !container.contains(selection.anchorNode) ||
    !container.contains(selection.focusNode)
  ) {
    return [];
  }

  return selection
    .toString()
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "");
};

const quoteDocument = (entry: Entry): RichTextDocument => {
  const lines = selectedLines(
    document.querySelector(`[data-comment-body="${entry.anchorId}"]`),
  );
  const quoted =
    lines.length > 0
      ? lines.map(line => ({
          content: [{ text: line, type: "text" }],
          type: "paragraph",
        }))
      : (entry.comment?.body.content ?? []);

  return {
    content: [{ content: quoted, type: "blockquote" }, { type: "paragraph" }],
    type: "doc",
  };
};

const useQuoteReply = (entry: Entry) => {
  const [quote, setQuote] = React.useState<null | Quote>(null);

  return {
    clearQuote: () => {
      setQuote(null);
    },
    quote,
    startQuote: () => {
      setQuote({ body: quoteDocument(entry), key: Date.now() });
      entry.item.setIsReplying(true);
    },
  };
};

const QuoteButton = ({
  entry,
  onQuote,
}: {
  entry: Entry;
  onQuote: () => void;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  if (!entry.item.canReply || entry.node.hidden) return null;

  return (
    <TooltipGroupTrigger
      content={t("quote_reply")}
      render={
        <Button
          aria-label={t("quote_reply")}
          className="text-muted-foreground"
          disabled={entry.item.isReplying}
          onClick={onQuote}
          onFocus={preloadContentCommentComposer}
          onMouseDown={event => {
            event.preventDefault();
          }}
          onPointerEnter={preloadContentCommentComposer}
          size="icon-sm"
          variant="ghost"
        />
      }
    >
      <QuoteIcon aria-hidden="true" />
    </TooltipGroupTrigger>
  );
};

const CommentHeader = ({ entry }: { entry: Entry }) => {
  const t = useTranslations("@vitnode/blog.comments");
  const tc = useTranslations("core.comments");
  const { comment } = entry;
  if (!comment) return null;
  const date = comment.publishedAt ?? comment.createdAt;

  return (
    <div className="flex min-h-8 min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
        {comment.author ? (
          <UserFormat
            className="text-foreground min-w-0 truncate font-semibold"
            format
            id={entry.authorId}
            link
            user={comment.author}
          />
        ) : (
          <span
            className="text-muted-foreground min-w-0 truncate font-medium"
            id={entry.authorId}
          >
            {tc("deleted_user")}
          </span>
        )}
        <a
          className="text-muted-foreground hover:text-foreground decoration-muted-foreground/50 rounded-sm tabular-nums"
          href={`${entry.thread.articleHref}#${entry.anchorId}`}
        >
          <time dateTime={new Date(date).toISOString()}>
            <DateFormat date={date} />
          </time>
          <span className="sr-only"> {tc("permalink")}</span>
        </a>
        {entry.node.editCount ? (
          entry.thread.signedIn ? (
            <CommentEdits
              commentId={comment.id}
              editCount={entry.node.editCount}
            />
          ) : (
            <span className="text-muted-foreground text-xs font-medium">
              {t("edits.trigger")}
            </span>
          )
        ) : null}
        {entry.node.hidden ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
            · <EyeOffIcon aria-hidden="true" className="size-3.5" />
            {tc("visibility.hidden_label")}
          </span>
        ) : null}
      </div>
      <div className="-me-2 flex shrink-0 items-center gap-1">
        {entry.isArticleAuthor ? (
          <Badge
            className="text-muted-foreground font-medium"
            variant="outline"
          >
            {t("article_author")}
          </Badge>
        ) : null}
        <ContentCommentActions item={entry.item} node={entry.node} />
      </div>
    </div>
  );
};

const CommentBody = ({ entry }: { entry: Entry }) =>
  entry.comment ? (
    <CommentBodyContent comment={entry.comment} entry={entry} />
  ) : null;

const CommentBodyContent = ({
  comment,
  entry,
}: {
  comment: PostComment;
  entry: Entry;
}) => {
  const tc = useTranslations("core.comments");
  const { elementRef, ...translation } = useAutoTranslation({
    contentTypeId: blogCommentContentType.id,
    fields: { body: comment.body },
    id: comment.id,
  });

  return (
    <>
      <div data-comment-body={entry.anchorId ?? undefined} ref={elementRef}>
        <RichTextContent
          className={cn(
            "text-base leading-relaxed text-pretty",
            entry.node.hidden ? "text-muted-foreground" : "text-foreground",
          )}
          content={translation.values.body}
        />
      </div>
      <AutoTranslateNote className="text-xs" translation={translation} />
      {entry.node.hidden && entry.node.hiddenReason ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {tc("visibility.hidden_reason", {
            reason: entry.node.hiddenReason,
          })}
        </p>
      ) : null}
    </>
  );
};

const ShareButton = ({ entry }: { entry: Entry }) => {
  const t = useTranslations("@vitnode/blog.comments");
  if (entry.node.hidden || !entry.comment) return null;

  return (
    <SharePopover
      description={t("share.description", { name: entry.authorName })}
      title={entry.thread.articleTitle}
      url={`${entry.thread.articleHref}#${entry.anchorId}`}
    >
      <TooltipGroupTrigger
        content={t("share.label")}
        render={
          <Button
            aria-describedby={entry.authorId}
            aria-label={t("share.label")}
            className="text-muted-foreground"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Share2Icon aria-hidden="true" />
      </TooltipGroupTrigger>
    </SharePopover>
  );
};

const Reactions = ({ entry }: { entry: Entry }) =>
  entry.item.reactionTarget && !entry.node.hidden ? (
    <ReactionBar target={entry.item.reactionTarget} />
  ) : null;

const ReplyComposer = ({
  className,
  entry,
  onClose,
  quote,
}: {
  className?: string;
  entry: Entry;
  onClose: () => void;
  quote: null | Quote;
}) => {
  const tc = useTranslations("core.comments");
  if (!entry.comment || !entry.item.isReplying) return null;
  const close = () => {
    entry.item.setIsReplying(false);
    onClose();
  };

  return (
    <div className={cn(ENTER_CLASS, className)}>
      <ContentCommentComposer
        autoFocus
        initialBody={quote?.body}
        key={quote?.key ?? "reply"}
        label={tc("form.answer_label", { name: entry.authorName })}
        mode="create"
        onCancel={close}
        onDone={(_outcome, id) => {
          close();
          if (typeof id === "number") entry.thread.setPostedReplyId(id);
        }}
        parentId={entry.comment.id}
        unavailable={
          entry.item.isRemoved ? tc("live.reply_removed") : undefined
        }
      />
    </div>
  );
};

const EditComposer = ({ entry }: { entry: Entry }) => {
  const tc = useTranslations("core.comments");
  if (!entry.comment || !entry.item.editing) return null;

  return (
    <ContentCommentComposer
      autoFocus
      editable={entry.item.editing}
      hideLabel
      id={entry.comment.id}
      label={tc("form.edit_label")}
      mode="edit"
      onCancel={entry.item.stopEditing}
      onDone={entry.item.stopEditing}
      unavailable={entry.item.isRemoved ? tc("live.edit_removed") : undefined}
    />
  );
};

const Notice = ({
  children,
  expanded = false,
  onToggle,
}: {
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) => {
  const t = useTranslations("@vitnode/blog.comments");

  return (
    <div
      className={cn(
        "bg-muted/40 flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2 transition-[border-color] duration-200",
        expanded ? "border-border" : "border-transparent",
      )}
    >
      <p className="text-muted-foreground text-sm leading-relaxed italic">
        {children}
      </p>
      {onToggle ? (
        <Button
          aria-expanded={expanded}
          className="text-muted-foreground shrink-0"
          onClick={onToggle}
          size="sm"
          variant="ghost"
        >
          <span aria-hidden="true" className="relative inline-flex size-4">
            <ChevronsUpDownIcon
              className={cn(
                "absolute inset-0 size-4 transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none",
                expanded ? "scale-75 opacity-0" : "scale-100 opacity-100",
              )}
            />
            <ChevronsDownUpIcon
              className={cn(
                "absolute inset-0 size-4 transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none",
                expanded ? "scale-100 opacity-100" : "scale-75 opacity-0",
              )}
            />
          </span>
          {expanded ? t("hidden.hide") : t("hidden.show")}
        </Button>
      ) : null}
    </div>
  );
};

const HiddenGate = ({
  children,
  entry,
}: {
  children: React.ReactNode;
  entry: Entry;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const [shown, setShown] = React.useState(false);
  const [wasHighlighted, setWasHighlighted] = React.useState(false);
  if (entry.isHighlighted !== wasHighlighted) {
    setWasHighlighted(entry.isHighlighted);
    if (entry.isHighlighted) setShown(true);
  }
  const open = shown || !!entry.item.editing;

  if (!entry.node.hidden) return <>{children}</>;

  return (
    <Collapsible onOpenChange={setShown} open={open}>
      <Notice
        expanded={open}
        onToggle={() => {
          setShown(!open);
        }}
      >
        {t("hidden.notice")}
      </Notice>
      <CollapsibleContent className={COLLAPSIBLE_PANEL_CLASS}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ReplyRow = ({
  isFirst,
  isLast,
  node,
  replyingTo,
}: {
  isFirst: boolean;
  isLast: boolean;
  node: CommentTreeNode;
  replyingTo: CommentTreeNode | null;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const tc = useTranslations("core.comments");
  const entry = useEntry(node);
  const { clearQuote, quote, startQuote } = useQuoteReply(entry);
  const postedReplyRef = usePostedReplyRef(entry);

  return (
    <li
      {...anchorProps(node, cn(entry.thread.animateEntries && ENTER_CLASS))}
      ref={postedReplyRef}
    >
      {entry.comment ? (
        <HiddenGate entry={entry}>
          <div
            className={cn(
              "px-4",
              entry.isHighlighted &&
                "bg-primary/5 ring-primary/50 ring-2 ring-inset",
            )}
          >
            <div className="flex gap-3">
              <div className="flex w-8 shrink-0 flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-3 w-0.5",
                    isFirst ? "bg-transparent" : "bg-border",
                  )}
                />
                <CommentAvatar node={node} />
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-0.5 flex-1",
                    isLast ? "bg-transparent" : "bg-border",
                  )}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-3 pb-3">
                {entry.item.editing ? (
                  <EditComposer entry={entry} />
                ) : (
                  <>
                    <div className="flex flex-col">
                      <CommentHeader entry={entry} />
                      {replyingTo?.record ? (
                        <p className="text-muted-foreground flex min-w-0 flex-wrap items-center gap-x-1 text-xs">
                          {t.rich("in_reply_to", {
                            name: () =>
                              replyingTo.record?.author ? (
                                <UserFormat
                                  className="min-w-0 truncate font-medium"
                                  format
                                  link
                                  user={replyingTo.record.author}
                                />
                              ) : (
                                <span className="font-medium">
                                  {tc("deleted_user")}
                                </span>
                              ),
                          })}
                        </p>
                      ) : null}
                    </div>
                    <CommentBody entry={entry} />
                    <div className="-ms-2 flex min-h-8 items-center justify-between gap-2">
                      <Reactions entry={entry} />
                      <div className="ms-auto -me-2 flex items-center">
                        <TooltipGroup>
                          <QuoteButton entry={entry} onQuote={startQuote} />
                          {entry.item.canReply ? (
                            <TooltipGroupTrigger
                              content={tc("reply")}
                              render={
                                <Button
                                  aria-expanded={entry.item.isReplying}
                                  aria-label={tc("reply")}
                                  className="text-muted-foreground"
                                  onClick={() => {
                                    entry.item.setIsReplying(
                                      !entry.item.isReplying,
                                    );
                                  }}
                                  onFocus={preloadContentCommentComposer}
                                  onPointerEnter={preloadContentCommentComposer}
                                  size="icon-sm"
                                  variant="ghost"
                                />
                              }
                            >
                              <ReplyIcon aria-hidden="true" />
                            </TooltipGroupTrigger>
                          ) : null}
                          <ShareButton entry={entry} />
                        </TooltipGroup>
                      </div>
                    </div>
                    <ReplyComposer
                      entry={entry}
                      onClose={clearQuote}
                      quote={quote}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </HiddenGate>
      ) : null}
    </li>
  );
};

const ThreadReplyField = ({
  entry,
  onClose,
  quote,
}: {
  entry: Entry;
  onClose: () => void;
  quote: null | Quote;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  if (!entry.comment || !entry.item.canReply) return null;
  if (entry.item.isReplying) {
    return (
      <ReplyComposer
        className="p-3"
        entry={entry}
        onClose={onClose}
        quote={quote}
      />
    );
  }

  return (
    <div className="p-3">
      <button
        className="border-input bg-background text-muted-foreground hover:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2.5 text-start text-sm transition-colors duration-150 ease-out outline-none focus-visible:ring-3"
        onClick={() => {
          entry.item.setIsReplying(true);
        }}
        onFocus={preloadContentCommentComposer}
        onPointerEnter={preloadContentCommentComposer}
        type="button"
      >
        {t("write_reply")}
      </button>
    </div>
  );
};

export const CommentThread = ({ node }: { node: CommentTreeNode }) => {
  const t = useTranslations("@vitnode/blog.comments");
  const entry = useEntry(node);
  const { clearQuote, quote, startQuote } = useQuoteReply(entry);
  const replies = React.useMemo(
    () =>
      flattenReplies(node)
        .filter(reply => reply.node.record !== null)
        .sort((a, b) => nodeTime(a.node) - nodeTime(b.node)),
    [node],
  );
  const replyCount = replies.length;

  return (
    <li
      {...anchorProps(node, cn(entry.thread.animateEntries && ENTER_CLASS))}
      style={{ viewTransitionName: `blog-comment-thread-${node.id}` }}
    >
      <div
        className={cn(
          "text-card-foreground overflow-hidden rounded-lg border",
          entry.isHighlighted && "ring-primary/50 ring-2",
        )}
      >
        {entry.comment ? (
          <HiddenGate entry={entry}>
            {entry.item.editing ? (
              <div className="p-4">
                <EditComposer entry={entry} />
              </div>
            ) : (
              <>
                <div className="bg-muted/40 border-b px-4 py-2">
                  <div className="flex items-center gap-3">
                    <CommentAvatar node={node} />
                    <div className="min-w-0 flex-1">
                      <CommentHeader entry={entry} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 px-4 pt-3 pb-3">
                  <CommentBody entry={entry} />
                  <div className="-ms-1 flex min-h-8 items-center justify-between gap-2">
                    <Reactions entry={entry} />
                    <div className="ms-auto -me-2 flex items-center gap-2">
                      {replyCount > 0 ? (
                        <span className="text-muted-foreground inline-flex items-center gap-1 text-sm tabular-nums">
                          {t.rich("reply_count", {
                            count: replyCount,
                            number: () => <SlidingNumber value={replyCount} />,
                          })}
                        </span>
                      ) : null}
                      <div className="flex items-center">
                        <TooltipGroup>
                          <QuoteButton entry={entry} onQuote={startQuote} />
                          <ShareButton entry={entry} />
                        </TooltipGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </HiddenGate>
        ) : null}
        {replies.length > 0 || entry.comment ? (
          <div
            className={cn(
              "bg-muted/40 dark:bg-background",
              entry.comment && "border-t",
            )}
          >
            {replies.length > 0 ? (
              <ol>
                {replies.map((reply, index) => (
                  <ReplyRow
                    isFirst={index === 0}
                    isLast={index === replies.length - 1}
                    key={reply.node.id}
                    node={reply.node}
                    replyingTo={reply.parent === node ? null : reply.parent}
                  />
                ))}
              </ol>
            ) : null}
            <div className={cn(replies.length > 0 && "border-t")}>
              <ThreadReplyField
                entry={entry}
                onClose={clearQuote}
                quote={quote}
              />
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
};
