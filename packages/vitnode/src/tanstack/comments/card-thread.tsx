import type { ContentId } from "@vitnode/api/content/ids";
import type { RichTextDocument } from "@vitnode/api/content/rich-text";

import { zodRichTextDocument } from "@vitnode/api/content/rich-text";
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

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { SharePopover } from "@/components/share-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { TooltipGroup, TooltipGroupTrigger } from "@/components/ui/tooltip";
import { UserFormat } from "@/components/user-format";
import { UserPreview } from "@/components/user-preview";
import { ReactionBar } from "@/tanstack/reactions/reaction-bar";
import { ReactionPoints } from "@/tanstack/reactions/reaction-points";

import type { ContentCommentNode, ContentCommentTreeNode } from "./thread";

import { contentCommentAuthor, contentCommentAuthorName } from "./author";
import { ContentCommentEditHistory } from "./edit-history";
import {
  ContentCommentActions,
  ContentCommentComposer,
  preloadContentCommentComposer,
  useContentCommentItem,
} from "./item";
import { useContentCommentsContext } from "./root";
import { CONTENT_COMMENT_ANCHOR_PREFIX } from "./thread";

/** How the default comments section links, labels and renders comments. */
export interface ContentCommentsDisplay<TRecord> {
  /**
   * What follows `comment-` in a comment's element id, for links such as
   * `#comment-42`. Defaults to the comment's id; return its slug to match
   * permalinks built from slugs.
   */
  anchorKey?: (record: TRecord) => string;
  /**
   * Users marked with an **Author** badge on their comments - the people who
   * wrote the commented record, such as an article's authors or a topic's
   * starter.
   */
  authorIds?: readonly number[];
  /**
   * The link on a comment's date, and what **Share** shares. Gets the element
   * id, e.g. `comment-42`. Defaults to `#comment-42` on the current page.
   */
  permalink?: (anchorId: string) => string;
  /**
   * A points pill (`ReactionPoints`) next to each comment's reactions: the sum
   * of its reactions' points from AdminCP → Reactions. Off by default.
   */
  points?: boolean;
  /** Replaces parts of a comment. Each gets the comment's public record. */
  render?: {
    /** Extra buttons in the row under the comment, next to **Reply**. */
    actions?: (record: TRecord) => React.ReactNode;
    /** The author's name; defaults to the `author` field's person. */
    author?: (record: TRecord) => React.ReactNode;
    /** The text; defaults to the rich-text `field`. */
    body?: (record: TRecord) => React.ReactNode;
    /** Extra details after the date, such as a badge. */
    meta?: (record: TRecord) => React.ReactNode;
  };
  /** The title **Share** sends along, usually the commented record's. */
  shareTitle?: string;
}

export type AnyCommentsDisplay = ContentCommentsDisplay<unknown>;

export type CommentTreeNode = ContentCommentTreeNode<unknown>;

export interface CardThreadContextValue {
  animateEntries: boolean;
  authorIds: ReadonlySet<number>;
  display: AnyCommentsDisplay;
  highlightedId: null | string;
  postedReplyId: ContentId | null;
  setPostedReplyId: (id: ContentId | null) => void;
  signedIn: boolean;
}

export const CardThreadContext =
  React.createContext<CardThreadContextValue | null>(null);

const useCardThread = () => {
  const thread = React.use(CardThreadContext);
  if (!thread) {
    throw new Error("Comment cards render inside CardThreadContext.");
  }

  return thread;
};

const ENTER_CLASS =
  "ease-fluid transition-[opacity,translate] duration-200 starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none";

const COLLAPSIBLE_PANEL_CLASS =
  "ease-fluid h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-[opacity]";

const recordField = (record: unknown, name: string): unknown =>
  typeof record === "object" && record !== null && name in record
    ? (record as Record<string, unknown>)[name]
    : undefined;

const readDate = (record: unknown, name: string): null | string => {
  const value = recordField(record, name);

  return typeof value === "string" ? value : null;
};

/** When a comment was published, or created before that. */
export const commentDate = (record: unknown): null | string =>
  readDate(record, "publishedAt") ?? readDate(record, "createdAt");

export const nodeTime = (node: ContentCommentNode<unknown>): number => {
  const date = node.record ? commentDate(node.record) : null;

  return date ? new Date(date).getTime() : 0;
};

/** The element id of a comment, e.g. `comment-42`. */
export const commentAnchorIdOf = (
  node: ContentCommentNode<unknown>,
  display: AnyCommentsDisplay,
): null | string =>
  node.record
    ? `${CONTENT_COMMENT_ANCHOR_PREFIX}${display.anchorKey ? display.anchorKey(node.record) : String(node.id)}`
    : null;

const permalinkOf = (display: AnyCommentsDisplay, anchorId: string) =>
  display.permalink ? display.permalink(anchorId) : `#${anchorId}`;

/** Every reply below `node`, at any depth, each with the comment it answers. */
const flattenReplies = (
  node: CommentTreeNode,
): { node: CommentTreeNode; parent: CommentTreeNode }[] =>
  node.children.flatMap(child => [
    { node: child, parent: node },
    ...flattenReplies(child),
  ]);

const useEntry = (node: CommentTreeNode) => {
  const thread = useCardThread();
  const { comments } = useContentCommentsContext();
  const t = useTranslations("core.comments");
  const item = useContentCommentItem(node);
  const record = node.record;
  const anchorId = commentAnchorIdOf(node, thread.display);
  const author = record ? contentCommentAuthor(record) : null;
  const body = record
    ? zodRichTextDocument.safeParse(recordField(record, comments.field))
    : null;

  return {
    anchorId,
    author,
    authorId: anchorId ? `${anchorId}-author` : undefined,
    authorName: contentCommentAuthorName(author) ?? t("deleted_user"),
    body: body?.success ? body.data : null,
    isRecordAuthor: !!author && thread.authorIds.has(author.id),
    isHighlighted: anchorId !== null && anchorId === thread.highlightedId,
    item,
    node,
    record,
    thread,
  };
};

type Entry = ReturnType<typeof useEntry>;

const usePostedReplyRef = (entry: Entry) => {
  const { node, thread } = entry;
  const posted = node.record !== null && node.id === thread.postedReplyId;

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

const anchorProps = (entry: Entry, className?: string) => ({
  className: cn("scroll-mt-24 outline-none", className),
  id: entry.anchorId ?? undefined,
  tabIndex: entry.anchorId ? -1 : undefined,
});

const CommentAvatar = ({ entry }: { entry: Entry }) =>
  entry.author ? (
    <UserPreview
      className="shrink-0 rounded-full"
      decorative
      nameCode={entry.author.nameCode}
    >
      <Avatar alt="" className="size-8" size={32} user={entry.author} />
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
      : (entry.body?.content ?? []);

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
  const t = useTranslations("core.comments");
  if (!entry.item.canReply || entry.node.hidden || !entry.body) return null;

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
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const { record } = entry;
  if (!record) return null;
  const date = commentDate(record);
  const { render } = entry.thread.display;

  return (
    <div className="flex min-h-8 min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
        <span className="min-w-0 truncate" id={entry.authorId}>
          {render?.author ? (
            render.author(record)
          ) : entry.author ? (
            <UserFormat
              className="text-foreground min-w-0 truncate font-semibold"
              format
              link
              user={entry.author}
            />
          ) : (
            <span className="text-muted-foreground font-medium">
              {t("deleted_user")}
            </span>
          )}
        </span>
        {date && entry.anchorId ? (
          <a
            className="text-muted-foreground hover:text-foreground rounded-sm tabular-nums underline-offset-4 hover:underline"
            href={permalinkOf(entry.thread.display, entry.anchorId)}
          >
            <time dateTime={new Date(date).toISOString()}>
              <DateFormat date={date} />
            </time>
            <span className="sr-only"> {t("permalink")}</span>
          </a>
        ) : null}
        {entry.node.editCount ? (
          entry.thread.signedIn && comments.history ? (
            <ContentCommentEditHistory
              commentId={entry.node.id}
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
            {t("visibility.hidden_label")}
          </span>
        ) : null}
        {render?.meta?.(record)}
      </div>
      <div className="-me-2 flex shrink-0 items-center gap-1">
        {entry.isRecordAuthor ? (
          <Badge
            className="text-muted-foreground font-medium"
            variant="outline"
          >
            {t("author_badge")}
          </Badge>
        ) : null}
        <ContentCommentActions item={entry.item} node={entry.node} />
      </div>
    </div>
  );
};

const CommentBody = ({ entry }: { entry: Entry }) => {
  const t = useTranslations("core.comments");
  const { record } = entry;
  if (!record) return null;
  const custom = entry.thread.display.render?.body;

  return (
    <>
      <div data-comment-body={entry.anchorId ?? undefined}>
        {custom ? (
          custom(record)
        ) : entry.body ? (
          <RichTextContent
            className={cn(
              "text-base leading-relaxed text-pretty",
              entry.node.hidden ? "text-muted-foreground" : "text-foreground",
            )}
            content={entry.body}
          />
        ) : null}
      </div>
      {entry.node.hidden && entry.node.hiddenReason ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("visibility.hidden_reason", { reason: entry.node.hiddenReason })}
        </p>
      ) : null}
    </>
  );
};

const ShareButton = ({ entry }: { entry: Entry }) => {
  const t = useTranslations("core.comments");
  if (entry.node.hidden || !entry.record || !entry.anchorId) return null;

  return (
    <SharePopover
      description={t("share.description", { name: entry.authorName })}
      title={entry.thread.display.shareTitle ?? ""}
      url={permalinkOf(entry.thread.display, entry.anchorId)}
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

const Reactions = ({ entry }: { entry: Entry }) => {
  const target = entry.item.reactionTarget;
  if (!target || entry.node.hidden) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entry.thread.display.points ? <ReactionPoints target={target} /> : null}
      <ReactionBar target={target} />
    </div>
  );
};

const ExtraActions = ({ entry }: { entry: Entry }) => {
  const actions = entry.thread.display.render?.actions;
  if (!entry.record || !actions) return null;

  return <>{actions(entry.record)}</>;
};

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
  const t = useTranslations("core.comments");
  if (!entry.record || !entry.item.isReplying) return null;
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
        label={t("form.answer_label", { name: entry.authorName })}
        mode="create"
        onCancel={close}
        onDone={(_outcome, id) => {
          close();
          if (id !== null) entry.thread.setPostedReplyId(id);
        }}
        parentId={entry.node.id}
        unavailable={entry.item.isRemoved ? t("live.reply_removed") : undefined}
      />
    </div>
  );
};

const EditComposer = ({ entry }: { entry: Entry }) => {
  const t = useTranslations("core.comments");
  if (!entry.record || !entry.item.editing) return null;

  return (
    <ContentCommentComposer
      autoFocus
      editable={entry.item.editing}
      hideLabel
      id={entry.node.id}
      label={t("form.edit_label")}
      mode="edit"
      onCancel={entry.item.stopEditing}
      onDone={entry.item.stopEditing}
      unavailable={entry.item.isRemoved ? t("live.edit_removed") : undefined}
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
  const t = useTranslations("core.comments");

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
  const t = useTranslations("core.comments");
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
  const t = useTranslations("core.comments");
  const entry = useEntry(node);
  const { clearQuote, quote, startQuote } = useQuoteReply(entry);
  const postedReplyRef = usePostedReplyRef(entry);
  const replyingToAuthor = replyingTo?.record
    ? contentCommentAuthor(replyingTo.record)
    : null;

  return (
    <li
      {...anchorProps(entry, cn(entry.thread.animateEntries && ENTER_CLASS))}
      ref={postedReplyRef}
    >
      {entry.record ? (
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
                <CommentAvatar entry={entry} />
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
                              replyingToAuthor ? (
                                <UserFormat
                                  className="min-w-0 truncate font-medium"
                                  format
                                  link
                                  user={replyingToAuthor}
                                />
                              ) : (
                                <span className="font-medium">
                                  {t("deleted_user")}
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
                        <ExtraActions entry={entry} />
                        <TooltipGroup>
                          <QuoteButton entry={entry} onQuote={startQuote} />
                          {entry.item.canReply ? (
                            <TooltipGroupTrigger
                              content={t("reply")}
                              render={
                                <Button
                                  aria-expanded={entry.item.isReplying}
                                  aria-label={t("reply")}
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
  const t = useTranslations("core.comments");
  if (!entry.record || !entry.item.canReply) return null;
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

/**
 * One conversation as a card: the top-level comment with its avatar, author,
 * date and actions on a tinted header, its text, reactions, **Quote** and
 * **Share**, then every reply below it in the order written - each naming
 * whom it answers - and a reply field at the bottom.
 */
export const ContentCommentCard = ({ node }: { node: CommentTreeNode }) => {
  const t = useTranslations("core.comments");
  const entry = useEntry(node);
  const { clearQuote, quote, startQuote } = useQuoteReply(entry);
  const replies = React.useMemo(
    () =>
      flattenReplies(node)
        .filter(reply => reply.node.record !== null)
        .toSorted((a, b) => nodeTime(a.node) - nodeTime(b.node)),
    [node],
  );
  const replyCount = replies.length;

  return (
    <li
      {...anchorProps(entry, cn(entry.thread.animateEntries && ENTER_CLASS))}
      style={{
        viewTransitionName: `content-comment-thread-${String(node.id)}`,
      }}
    >
      <div
        className={cn(
          "text-card-foreground overflow-hidden rounded-lg border",
          entry.isHighlighted && "ring-primary/50 ring-2",
        )}
      >
        {entry.record ? (
          <HiddenGate entry={entry}>
            {entry.item.editing ? (
              <div className="p-4">
                <EditComposer entry={entry} />
              </div>
            ) : (
              <>
                <div className="bg-muted/40 border-b px-4 py-2">
                  <div className="flex items-center gap-3">
                    <CommentAvatar entry={entry} />
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
                        <ExtraActions entry={entry} />
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
        ) : (
          <RemovedHeader node={node} />
        )}
        {replies.length > 0 || entry.record ? (
          <div
            className={cn(
              "bg-muted/40 dark:bg-background",
              (entry.record !== null || replies.length > 0) && "border-t",
            )}
          >
            {replies.length > 0 ? (
              <ol>
                {replies.map((reply, index) => (
                  <ReplyRow
                    isFirst={index === 0}
                    isLast={index === replies.length - 1}
                    key={String(reply.node.id)}
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

/**
 * The header of a conversation whose first comment was deleted or hidden from
 * this reader while it still had replies: no text, no author.
 */
const RemovedHeader = ({ node }: { node: CommentTreeNode }) => {
  const t = useTranslations("core.comments");
  const { deleted } = node;

  return (
    <Notice>
      {deleted
        ? deleted.byAuthor
          ? t("placeholder.by_author")
          : t("placeholder.by_moderator")
        : t("removed")}
    </Notice>
  );
};
