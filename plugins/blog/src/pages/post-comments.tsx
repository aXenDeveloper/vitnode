import type { ContentPermissions } from "@vitnode/core/tanstack/content";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@vitnode/core/components/avatar";
import { ConfirmActionAlertDialog } from "@vitnode/core/components/confirm-action/confirm-action-alert-dialog";
import { DateFormat } from "@vitnode/core/components/date-format";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { SharePopover } from "@vitnode/core/components/share-popover";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@vitnode/core/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vitnode/core/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@vitnode/core/components/ui/popover";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { UserFormat } from "@vitnode/core/components/user-format";
import { contentTarget, zodRichTextDocument } from "@vitnode/core/content";
import { useRevealHashTarget } from "@vitnode/core/hooks/use-reveal-hash-target";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportDialog } from "@vitnode/core/tanstack/moderation";
import { cn } from "cn";
import {
  ChevronDownIcon,
  CircleMinusIcon,
  CirclePlusIcon,
  CornerDownRightIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  LogInIcon,
  MessageSquareIcon,
  PencilIcon,
  PenLineIcon,
  ReplyIcon,
  RotateCwIcon,
  Share2Icon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import {
  BLOG_COMMENT_MAX_DEPTH,
  blogCommentContentType,
} from "@/content/comment";
import { manifest } from "@/manifest.gen";

import type { PostCommentComposerProps } from "./post-comment-composer";
import type { PostCommentHideFormProps } from "./post-comment-hide-form";
import type {
  CommentPerson,
  CommentTreeNode,
  PostComment,
} from "./post-comments-data";

import { useCommentRejection } from "./post-comment-errors";
import {
  buildCommentTree,
  commentAnchorId,
  postCommentsQueryOptions,
  useCommentPermissions,
} from "./post-comments-data";
import { blogQueryKeys } from "./post-query";

const EDITED_AFTER_MS = 60_000;

const COMMENT_ACTION_CLASS = "text-muted-foreground font-semibold";

const loadCommentComposer = async () => await import("./post-comment-composer");

const CommentComposer = lazy(loadCommentComposer);

const preloadCommentComposer = () => {
  void loadCommentComposer();
};

const ComposerFallback = () => (
  <Skeleton aria-hidden="true" className="h-40 w-full rounded-lg" />
);

const LazyCommentComposer = (props: PostCommentComposerProps) => (
  <Suspense fallback={<ComposerFallback />}>
    <CommentComposer {...props} />
  </Suspense>
);

const loadCommentHideForm = async () =>
  await import("./post-comment-hide-form");

const CommentHideForm = lazy(loadCommentHideForm);

const preloadCommentHideForm = () => {
  void loadCommentHideForm();
};

const LazyCommentHideForm = (props: PostCommentHideFormProps) => (
  <Suspense
    fallback={
      <Skeleton aria-hidden="true" className="h-36 w-full rounded-lg" />
    }
  >
    <CommentHideForm {...props} />
  </Suspense>
);

const zodProposedBody = z.object({ body: zodRichTextDocument.optional() });

const useCommentEditor = () => {
  const reject = useCommentRejection([]);
  const t = useTranslations("@vitnode/blog.comments.errors");

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

const displayNameOf = (person: CommentPerson): null | string =>
  person ? (person.fullName ?? person.name) : null;

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
  const t = useTranslations("@vitnode/blog.comments");

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
  articleId: number;
  articleTitle: string;
  canComment: boolean;
  currentUserId: null | number;
  hashTargetId: null | string;
  highlightedId: null | string;
  onChanged: (outcome: { pending: boolean }) => void;
  onDelete: (comment: PostComment) => void;
  onReport: (comment: PostComment) => void;
  permissionsOf: (id: number) => ContentPermissions;
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

const useCommentVisibility = (onChanged: () => void) => {
  const t = useTranslations("@vitnode/blog.comments");
  const [isPending, setIsPending] = useState(false);

  const change = async (
    commentId: number,
    action: "hide" | "unhide",
    reason: null | string = null,
  ): Promise<boolean> => {
    setIsPending(true);
    try {
      const res =
        action === "hide"
          ? await fetcher({
              plugin: manifest.id,
              method: "post",
              module: "content/comments",
              path: "/{id}/hide",
              args: {
                params: { id: commentId },
                body: reason === null ? {} : { reason },
              },
            })
          : await fetcher({
              plugin: manifest.id,
              method: "post",
              module: "content/comments",
              path: "/{id}/unhide",
              args: { params: { id: commentId } },
            });

      if (res.status !== 200) {
        toast.error(t("errors.title"), {
          description:
            res.status === 403 ? t("errors.forbidden") : t("errors.unknown"),
        });

        return false;
      }

      toast.success(t(`visibility.${action}.title`), {
        description: t(`visibility.${action}.desc`),
      });
      onChanged();

      return true;
    } finally {
      setIsPending(false);
    }
  };

  return { change, isPending };
};

interface MenuOrigin {
  height: number;
  width: number;
}

const HIDE_PROMPT_MORPH_CLASS =
  "[clip-path:inset(-2rem_round_var(--radius-lg))] transition-[opacity,scale,clip-path] duration-200 data-starting-style:scale-100 data-starting-style:[clip-path:inset(0_calc(100%-var(--menu-width,100%))_calc(100%-var(--menu-height,100%))_0_round_var(--radius-lg))] data-[side=top]:data-starting-style:[clip-path:inset(calc(100%-var(--menu-height,100%))_calc(100%-var(--menu-width,100%))_0_0_round_var(--radius-lg))]";

const CommentMenu = ({
  canDelete,
  canEdit,
  canHide,
  canReport,
  comment,
  isBusy,
  isHidden,
  onDelete,
  onEdit,
  onReport,
  onVisibility,
  triggerRef,
}: {
  canDelete: boolean;
  canEdit: boolean;
  canHide: boolean;
  canReport: boolean;
  comment: PostComment;
  isBusy: boolean;
  isHidden: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onReport: () => void;
  onVisibility: (origin: MenuOrigin | null) => void;
  triggerRef: React.Ref<HTMLButtonElement>;
}) => {
  const t = useTranslations("@vitnode/blog.comments");
  const label = t("more_actions", {
    name: displayNameOf(comment.author) ?? t("deleted_user"),
  });

  const menuRef = useRef<HTMLDivElement>(null);

  if (!canEdit && !canReport && !canHide && !canDelete) return null;

  const preload = () => {
    if (canEdit) preloadCommentComposer();
    if (canHide && !isHidden) preloadCommentHideForm();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onFocus={preload}
        onPointerEnter={preload}
        ref={triggerRef}
        render={
          <Button
            aria-label={label}
            className={COMMENT_ACTION_CLASS}
            isLoading={isBusy}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44" ref={menuRef}>
        {canEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon aria-hidden="true" />
            {t("edit")}
          </DropdownMenuItem>
        ) : null}
        {canReport ? (
          <DropdownMenuItem onClick={onReport}>
            <FlagIcon aria-hidden="true" />
            {t("report")}
          </DropdownMenuItem>
        ) : null}
        {(canHide || canDelete) && (canEdit || canReport) ? (
          <DropdownMenuSeparator />
        ) : null}
        {canHide ? (
          <DropdownMenuItem
            onClick={() => {
              const rect = menuRef.current?.getBoundingClientRect();
              onVisibility(
                rect ? { height: rect.height, width: rect.width } : null,
              );
            }}
          >
            {isHidden ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeOffIcon aria-hidden="true" />
            )}
            {isHidden
              ? t("visibility.unhide.action")
              : t("visibility.hide.action")}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <Trash2Icon aria-hidden="true" />
            {t("delete.action")}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

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
  const openEditor = useCommentEditor();
  const visibility = useCommentVisibility(() => {
    actions.onChanged({ pending: false });
  });
  const [isReplying, setIsReplying] = useState(false);
  const [editing, setEditing] = useState<null | {
    body: PostComment["body"];
    version: number;
  }>(null);
  const [isOpeningEditor, setIsOpeningEditor] = useState(false);
  const [isHidePromptOpen, setIsHidePromptOpen] = useState(false);
  const [hidePromptOrigin, setHidePromptOrigin] = useState<MenuOrigin | null>(
    null,
  );
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { canDelete, canEdit, canHide, canReport } = actions.permissionsOf(
    comment.id,
  );
  const isHidden = node.hidden;
  const canAnswer =
    actions.canComment && !isHidden && node.depth < BLOG_COMMENT_MAX_DEPTH;
  const anchorId = commentAnchorId(comment.slug);
  const authorId = `${anchorId}-author`;
  const isOwn =
    actions.currentUserId !== null &&
    comment.author?.id === actions.currentUserId;
  const isEdited =
    comment.publishedAt !== null &&
    new Date(comment.updatedAt).getTime() -
      new Date(comment.publishedAt).getTime() >
      EDITED_AFTER_MS;
  const date = comment.publishedAt ?? comment.createdAt;

  const startEditing = async () => {
    setIsOpeningEditor(true);
    try {
      const editable = await openEditor(comment.id);
      if (editable) setEditing(editable);
    } finally {
      setIsOpeningEditor(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
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
        <article
          aria-labelledby={authorId}
          className={cn(
            "flex w-fit max-w-full min-w-0 flex-col gap-0.5 rounded-2xl rounded-ss-sm px-4 py-2.5",
            isHidden
              ? "bg-muted/40 border border-dashed"
              : isOwn
                ? "bg-primary/10"
                : "bg-muted",
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
              <HrefLink
                className="hover:text-foreground rounded-sm tabular-nums hover:underline"
                href={`${actions.articleHref}#${anchorId}`}
              >
                <time dateTime={new Date(date).toISOString()}>
                  <DateFormat date={date} />
                </time>
                <span className="sr-only"> {t("permalink")}</span>
              </HrefLink>
              {isEdited ? <span>· {t("edited_label")}</span> : null}
              {isHidden ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  · <EyeOffIcon aria-hidden="true" className="size-3.5" />
                  {t("visibility.hidden_label")}
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
              {t("visibility.hidden_reason", { reason: node.hiddenReason })}
            </p>
          ) : null}
        </article>
      )}

      {editing ? null : (
        <div className="flex flex-wrap items-center gap-x-1 ps-2">
          {canAnswer ? (
            <Button
              aria-expanded={isReplying}
              className={COMMENT_ACTION_CLASS}
              onClick={() => {
                setIsReplying(!isReplying);
              }}
              onFocus={preloadCommentComposer}
              onPointerEnter={preloadCommentComposer}
              size="xs"
              variant="ghost"
            >
              <ReplyIcon aria-hidden="true" />
              {t("reply")}
            </Button>
          ) : null}
          {isHidden ? null : (
            <SharePopover
              description={t("share.description", {
                name: displayNameOf(comment.author) ?? t("deleted_user"),
              })}
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
          <CommentMenu
            canDelete={canDelete}
            canEdit={canEdit}
            canHide={canHide}
            canReport={canReport}
            comment={comment}
            isBusy={isOpeningEditor || visibility.isPending}
            isHidden={isHidden}
            onDelete={() => {
              actions.onDelete(comment);
            }}
            onEdit={() => {
              void startEditing();
            }}
            onReport={() => {
              actions.onReport(comment);
            }}
            onVisibility={origin => {
              if (isHidden) {
                void visibility.change(comment.id, "unhide");
              } else {
                setHidePromptOrigin(origin);
                setIsHidePromptOpen(true);
              }
            }}
            triggerRef={menuTriggerRef}
          />
          {canHide && !isHidden ? (
            <Popover onOpenChange={setIsHidePromptOpen} open={isHidePromptOpen}>
              <PopoverContent
                align="start"
                anchor={menuTriggerRef}
                className={cn(
                  "w-80 max-w-[calc(100vw-2rem)]",
                  HIDE_PROMPT_MORPH_CLASS,
                )}
                style={
                  hidePromptOrigin
                    ? ({
                        "--menu-height": `${hidePromptOrigin.height}px`,
                        "--menu-width": `${hidePromptOrigin.width}px`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                <PopoverHeader>
                  <PopoverTitle>
                    {t("visibility.hide.prompt_title")}
                  </PopoverTitle>
                  <PopoverDescription>
                    {t("visibility.hide.prompt_desc")}
                  </PopoverDescription>
                </PopoverHeader>
                <LazyCommentHideForm
                  onCancel={() => {
                    setIsHidePromptOpen(false);
                  }}
                  onHide={async reason => {
                    if (await visibility.change(comment.id, "hide", reason)) {
                      setIsHidePromptOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : null}
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
              {t("show_answers", { count: replies.count })}
            </Button>
          ) : null}
        </div>
      )}

      {isReplying ? (
        <div className="pt-2">
          <LazyCommentComposer
            articleId={actions.articleId}
            autoFocus
            label={t("form.answer_label", {
              name: displayNameOf(comment.author) ?? t("someone"),
            })}
            mode="create"
            onCancel={() => {
              setIsReplying(false);
            }}
            onDone={outcome => {
              setIsReplying(false);
              actions.onChanged(outcome);
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
  const t = useTranslations("@vitnode/blog.comments");
  const Icon = open ? CircleMinusIcon : CirclePlusIcon;

  return (
    <CollapsibleTrigger
      aria-label={
        open ? t("hide_answers", { count }) : t("show_answers", { count })
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
    ? (displayNameOf(node.record.author) ?? t("deleted_user"))
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
  const t = useTranslations("@vitnode/blog.comments");
  const { deleted } = node;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="bg-muted/40 text-muted-foreground flex w-fit max-w-full flex-col gap-0.5 rounded-2xl rounded-ss-sm border border-dashed px-4 py-2.5">
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
              ? t("hide_answers", { count: replies.count })
              : t("show_answers", { count: replies.count })}
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
  const t = useTranslations("@vitnode/blog.comments");
  const queryClient = useQueryClient();
  const authorIdSet = useMemo(
    () => new Set(articleAuthorIds),
    [articleAuthorIds],
  );
  const { data: session, isPending: isSessionPending } = useSessionQuery();
  const currentUserId = session?.user?.id ?? null;
  const comments = useInfiniteQuery(postCommentsQueryOptions(articleId));
  const [composerKey, setComposerKey] = useState(0);
  const [composer, setComposer] = useState<"closed" | "open" | "opening">(
    "closed",
  );
  const [reporting, setReporting] = useState<null | PostComment>(null);
  const [deleting, setDeleting] = useState<null | PostComment>(null);

  const pages = comments.data?.pages;
  const items = useMemo(
    () => pages?.flatMap(page => page.items) ?? [],
    [pages],
  );
  const tree = useMemo(() => buildCommentTree(items), [items]);
  const permissions = useCommentPermissions(
    items.flatMap(item => (item.record ? [item.id] : [])),
  );
  const last = pages?.at(-1);
  const commentCount = last?.replyCount ?? 0;

  const loadMore = useCallback(async () => {
    const result = await comments.fetchNextPage();
    if (result.isError) {
      toast.error(t("load_failed.title"), {
        description: t("load_failed.desc"),
      });
    }
  }, [comments, t]);

  const onChanged = useCallback(
    ({ pending }: { pending: boolean }) => {
      if (pending) return;
      void queryClient.invalidateQueries({
        queryKey: blogQueryKeys.comments(articleId),
      });
      void queryClient.invalidateQueries({
        queryKey: blogQueryKeys.commentPermissions,
      });
    },
    [articleId, queryClient],
  );

  const anchor = useRevealHashTarget({
    hasMore: comments.hasNextPage,
    isLoadingMore: comments.isFetchingNextPage,
    loadMore,
    prefix: "comment-",
    ready: comments.isSuccess,
    renderedCount: items.length,
  });
  const highlightedId = anchor.status === "found" ? anchor.targetId : null;

  const actions = useMemo<ThreadActions>(
    () => ({
      articleAuthorIds: authorIdSet,
      articleHref,
      articleId,
      articleTitle,
      canComment: currentUserId !== null,
      currentUserId,
      hashTargetId: anchor.targetId,
      highlightedId,
      onChanged,
      onDelete: setDeleting,
      onReport: setReporting,
      permissionsOf: permissions.of,
    }),
    [
      anchor.targetId,
      authorIdSet,
      articleHref,
      articleId,
      articleTitle,
      currentUserId,
      highlightedId,
      onChanged,
      permissions.of,
    ],
  );

  return (
    <section
      aria-labelledby="blog-comments"
      className="flex flex-col gap-6 border-t pt-10"
      id="comments"
    >
      <h2
        className="text-foreground flex items-center gap-2 text-2xl font-semibold tracking-tight text-balance"
        id="blog-comments"
      >
        <MessageSquareIcon
          aria-hidden="true"
          className="text-muted-foreground size-5"
        />
        {t("title", { count: commentCount })}
      </h2>

      {comments.isPending ? (
        <CommentsPendingSkeleton label={t("loading")} />
      ) : comments.isError ? (
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("load_failed.title")}. {t("load_failed.desc")}
          </p>
          <Button
            isLoading={comments.isFetching}
            onClick={() => {
              void comments.refetch();
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
        <ol aria-busy={comments.isFetching} className="flex flex-col gap-6">
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

      {last?.truncated ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("truncated")}
        </p>
      ) : null}

      {comments.hasNextPage ? (
        <Button
          className="self-start"
          isLoading={comments.isFetchingNextPage}
          onClick={loadMore}
          variant="outline"
        >
          <ChevronDownIcon aria-hidden="true" />
          {t("load_more")}
        </Button>
      ) : null}

      <div className="flex items-start gap-3">
        <RailMarker>
          <PencilIcon />
        </RailMarker>
        <div className="bg-card text-card-foreground flex min-w-0 flex-1 flex-col gap-3 rounded-2xl rounded-ss-sm border p-4">
          <h3 className="font-semibold text-balance">{t("compose.title")}</h3>
          {isSessionPending ? (
            <ComposerFallback />
          ) : currentUserId === null ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground leading-relaxed text-pretty">
                {t("compose.guest")}
              </p>
              <HrefLink
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/login?returnTo=${encodeURIComponent(`${articleHref}#comments`)}`}
              >
                <LogInIcon aria-hidden="true" />
                {t("compose.sign_in")}
              </HrefLink>
            </div>
          ) : composer === "closed" ? (
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
              articleId={articleId}
              autoFocus={composer === "opening"}
              key={composerKey}
              label={t("form.body_label")}
              mode="create"
              onCancel={() => {
                setComposer("closed");
              }}
              onDone={outcome => {
                setComposer("open");
                setComposerKey(composerKey + 1);
                onChanged(outcome);
              }}
              parentId={null}
            />
          )}
        </div>
      </div>

      <ConfirmActionAlertDialog
        description={t("delete.desc")}
        icon={<Trash2Icon />}
        onOpenChange={open => {
          if (!open) setDeleting(null);
        }}
        onSubmit={async ({ onClose }) => {
          if (!deleting) return;
          const res = await fetcher({
            plugin: manifest.id,
            method: "post",
            module: "content/comments",
            path: "/{id}/delete",
            args: { params: { id: deleting.id } },
          });

          if (res.status !== 200) {
            toast.error(t("errors.title"), {
              description:
                res.status === 403
                  ? t("errors.forbidden")
                  : res.status === 404
                    ? t("errors.not_found")
                    : t("errors.unknown"),
            });

            return;
          }

          toast.success(t("delete.done.title"), {
            description: t("delete.done.desc"),
          });
          onClose();
          onChanged({ pending: false });
        }}
        open={deleting !== null}
        textSubmit={
          <>
            <Trash2Icon aria-hidden="true" />
            {t("delete.confirm")}
          </>
        }
        title={t("delete.title")}
      />

      {reporting ? (
        <ReportDialog
          onOpenChange={open => {
            if (!open) setReporting(null);
          }}
          open
          target={contentTarget(
            manifest.id,
            blogCommentContentType,
            reporting.id,
          )}
          typeLabel={t("report_type")}
        />
      ) : null}
    </section>
  );
};
