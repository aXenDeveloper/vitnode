import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ChevronDownIcon,
  EyeOffIcon,
  LogInIcon,
  MessageSquareIcon,
  PencilIcon,
  ReplyIcon,
  RotateCwIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormat } from "@/components/user-format";
import { zodRichTextDocument } from "@/content/rich-text";
import { useRevealHashTarget } from "@/hooks/use-reveal-hash-target";

import type { ContentCommentNode, ContentCommentTreeNode } from "./thread";
import type { ContentCommentsController } from "./use-content-comments";

import { LOGIN_PATH, returnToFor } from "../auth/redirects";
import {
  ContentCommentActions,
  contentCommentAuthor,
  contentCommentAuthorName,
  ContentCommentComposer,
  preloadContentCommentComposer,
  useContentCommentItem,
} from "./item";
import { ContentCommentsRoot, useContentCommentsContext } from "./root";

const EDITED_AFTER_MS = 60_000;

/** The `id` prefix of every comment element, for `#comment-...` links. */
export const CONTENT_COMMENT_ANCHOR_PREFIX = "comment-";

/** How the default comments section links, labels and renders comments. */
export interface ContentCommentsDisplay<TRecord> {
  /**
   * What follows `comment-` in a comment's element id, for links such as
   * `#comment-42`. Defaults to the comment's id; return its slug to match
   * permalinks built from slugs.
   */
  anchorKey?: (record: TRecord) => string;
  /**
   * The link on a comment's date. Gets the element id, e.g. `comment-42`.
   * Defaults to `#comment-42` on the current page.
   */
  permalink?: (anchorId: string) => string;
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
}

type AnyDisplay = ContentCommentsDisplay<unknown>;

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
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-1 gap-3">
      {person ? (
        <Avatar alt="" className="size-8 shrink-0" size={32} user={person} />
      ) : (
        <span
          aria-hidden="true"
          className="bg-muted size-8 shrink-0 rounded-full"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
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

        <div className="flex flex-wrap items-center gap-x-1 ps-2">
          {item.canReply ? (
            <Button
              aria-expanded={item.isReplying}
              className="text-muted-foreground font-semibold"
              onClick={() => {
                item.setIsReplying(!item.isReplying);
              }}
              onFocus={preloadContentCommentComposer}
              onPointerEnter={preloadContentCommentComposer}
              size="xs"
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
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Deeper replies stop indenting here, so narrow screens keep their width. */
const INDENT_UNTIL_DEPTH = 3;

const CommentBranch = ({
  display,
  highlightedId,
  node,
}: {
  display: AnyDisplay;
  highlightedId: null | string;
  node: ContentCommentTreeNode<unknown>;
}) => {
  const anchorId = anchorIdOf(node, display);

  return (
    <li
      className="flex scroll-mt-24 flex-col gap-4 outline-none"
      id={anchorId ?? undefined}
      tabIndex={anchorId ? -1 : undefined}
    >
      <ContentCommentItem
        display={display}
        highlighted={anchorId !== null && anchorId === highlightedId}
        node={node}
      />
      {node.children.length > 0 ? (
        <ol
          className={cn(
            "flex flex-col gap-4",
            node.depth < INDENT_UNTIL_DEPTH && "ms-4 border-s ps-4",
          )}
        >
          {node.children.map(child => (
            <CommentBranch
              display={display}
              highlightedId={highlightedId}
              key={String(child.id)}
              node={child}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
};

const COMMENT_SKELETON_KEYS = ["first", "second", "third"];

const CommentsSkeleton = ({ label }: { label: string }) => (
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
 * The new-comment card: the composer for a signed-in visitor, a sign-in link
 * for a guest that returns here, or nothing when the thread has no `create`.
 */
export const ContentCommentsComposer = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const returnTo = useRouterState({
    select: state => returnToFor(state.location),
  });
  const [state, setState] = React.useState<"closed" | "open" | "opening">(
    "closed",
  );
  const [formKey, setFormKey] = React.useState(0);
  if (!comments.features.create) return null;

  return (
    <div
      className={cn(
        "bg-card text-card-foreground flex min-w-0 flex-col gap-3 rounded-2xl border p-4",
        className,
      )}
    >
      <h3 className="font-semibold text-balance">{t("compose.title")}</h3>
      {comments.isSessionPending ? (
        <Skeleton aria-hidden="true" className="h-12 w-full rounded-lg" />
      ) : comments.canComment ? (
        state === "closed" ? (
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
        )
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("compose.guest")}
          </p>
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            search={{ returnTo }}
            to={LOGIN_PATH}
          >
            <LogInIcon aria-hidden="true" />
            {t("compose.sign_in")}
          </Link>
        </div>
      )}
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
  const anchor = useRevealHashTarget({
    hasMore: comments.hasMore,
    isLoadingMore: comments.isLoadingMore,
    loadMore: comments.loadMore,
    prefix: CONTENT_COMMENT_ANCHOR_PREFIX,
    ready: comments.status === "success",
    renderedCount: comments.items.length,
  });
  const highlightedId = anchor.status === "found" ? anchor.targetId : null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-6", className)}
      id="comments"
    >
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
        <ol aria-busy={comments.isRefreshing} className="flex flex-col gap-6">
          {comments.tree.map(node => (
            <CommentBranch
              display={display}
              highlightedId={highlightedId}
              key={String(node.id)}
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
      {comments.truncated ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("truncated")}
        </p>
      ) : null}
      <ContentCommentsLoadMore />
      <ContentCommentsComposer />
    </section>
  );
};

/**
 * A complete comment section for one Content Engine record: the count, the
 * thread with replies, load more, the composer or a sign-in link, and every
 * action the plugin wired into `useContentComments` and the server allows.
 * Scrolls to and rings the comment a `#comment-...` link points to, loading
 * more pages until it appears.
 *
 * For your own layout, use `ContentCommentsRoot` with `ContentCommentItem`,
 * `ContentCommentActions` and `ContentCommentComposer` instead.
 *
 * @example
 * ```tsx
 * <ContentComments comments={comments} />
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
