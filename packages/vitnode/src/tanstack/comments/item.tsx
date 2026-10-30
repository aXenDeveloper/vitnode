import { cn } from "cn";
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  FlagIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { ContentPublicPerson } from "@/content/public-person";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { zodContentPublicPerson } from "@/content/public-person";

import type { ContentCommentComposerFormProps } from "./composer-form";
import type { ContentCommentHideFormProps } from "./hide-form";
import type { ContentCommentNode } from "./thread";
import type { ContentCommentEditable } from "./use-content-comments";

import { useContentCommentErrorToast, useContentCommentsContext } from "./root";

const loadComposer = async () => await import("./composer-form");
const ComposerForm = React.lazy(loadComposer);

/** Starts loading the comment form, e.g. when the pointer reaches **Reply**. */
export const preloadContentCommentComposer = () => {
  void loadComposer();
};

/**
 * The comment form - a new comment, a reply or an edit - loaded on first use
 * with a skeleton of its size. Render it inside a comments root.
 */
export const ContentCommentComposer = (
  props: ContentCommentComposerFormProps,
) => (
  <React.Suspense
    fallback={
      <Skeleton aria-hidden="true" className="h-40 w-full rounded-lg" />
    }
  >
    <ComposerForm {...props} />
  </React.Suspense>
);

const loadHideForm = async () => await import("./hide-form");
const HideForm = React.lazy(loadHideForm);

const LazyHideForm = (props: ContentCommentHideFormProps) => (
  <React.Suspense
    fallback={
      <Skeleton aria-hidden="true" className="h-36 w-full rounded-lg" />
    }
  >
    <HideForm {...props} />
  </React.Suspense>
);

const zodAuthor = zodContentPublicPerson.nullable().catch(null);

/**
 * The comment's author from its public record's `author` field, or `null`
 * for a deleted account or a content type without one. Pure.
 */
export const contentCommentAuthor = (
  record: unknown,
): ContentPublicPerson | null =>
  typeof record === "object" && record !== null && "author" in record
    ? zodAuthor.parse(record.author)
    : null;

/** The name to show for a person, preferring a real name they share. Pure. */
export const contentCommentAuthorName = (
  person: ContentPublicPerson | null,
): null | string => (person ? (person.fullName ?? person.name) : null);

/**
 * The state one comment needs: what the visitor may do with it, whether an
 * action runs on it, and its edit and reply forms. Use it to build your own
 * comment; `ContentComments` uses it for every comment it renders.
 */
export const useContentCommentItem = (node: ContentCommentNode<unknown>) => {
  const { comments } = useContentCommentsContext();
  const showError = useContentCommentErrorToast();
  const [editing, setEditing] = React.useState<ContentCommentEditable | null>(
    null,
  );
  const [isReplying, setIsReplying] = React.useState(false);
  const permissions = comments.permissionsOf(node.id);
  const isBusy = comments.busy !== null && comments.busy.id === node.id;
  const hasDraft = editing !== null || isReplying;
  const { trackDraft } = comments;

  // A live update must not unmount a form the reader is typing in.
  React.useEffect(() => {
    if (!hasDraft) return;
    trackDraft(node.id, true);

    return () => {
      trackDraft(node.id, false);
    };
  }, [hasDraft, node.id, trackDraft]);

  return {
    /** Whether **Reply** shows: the visitor may write, under `maxDepth`, not hidden. */
    canReply: comments.canReply(node),
    /** The values the edit form opened with, or `null` when not editing. */
    editing,
    /** `true` while any action runs on the thread; start no other. */
    isAnyBusy: comments.busy !== null,
    /** `true` while an action runs on this comment. */
    isBusy,
    isReplying,
    /**
     * The comment was removed, or is no longer visible to this reader, while
     * a form was open on it: it stays only so the typed text is not lost, and
     * can no longer be saved or answered.
     */
    isRemoved: node.removed && node.record !== null,
    /** The server's answers, limited to the actions the plugin wired up. */
    permissions: {
      canDelete: comments.features.delete && permissions.canDelete,
      canEdit: comments.features.edit && permissions.canEdit,
      canHide: comments.features.hide && permissions.canHide,
      canReport: comments.features.report && permissions.canReport,
    },
    setIsReplying,
    /** Loads the editable values, then opens the edit form. */
    startEditing: async () => {
      if (comments.busy) return;
      comments.setEditing(node.id);
      try {
        const result = await comments.loadEditable(node.id);
        if (result.ok) setEditing(result.value);
        else showError(result.status);
      } finally {
        comments.setEditing(null);
      }
    },
    stopEditing: () => {
      setEditing(null);
    },
  };
};

/** What `useContentCommentItem` returns. */
export type ContentCommentItemState = ReturnType<typeof useContentCommentItem>;

interface MenuOrigin {
  height: number;
  width: number;
}

const HIDE_PROMPT_MORPH_CLASS =
  "[clip-path:inset(-2rem_round_var(--radius-lg))] transition-[opacity,scale,clip-path] duration-200 data-starting-style:scale-100 data-starting-style:[clip-path:inset(0_calc(100%-var(--menu-width,100%))_calc(100%-var(--menu-height,100%))_0_round_var(--radius-lg))] data-[side=top]:data-starting-style:[clip-path:inset(calc(100%-var(--menu-height,100%))_calc(100%-var(--menu-width,100%))_0_0_round_var(--radius-lg))]";

/**
 * The **More actions** menu of one comment: Edit, Report, Hide or Unhide and
 * Delete, each shown only when the plugin wired it up and the server allows
 * it. Hiding asks for an optional reason in a popover; deleting asks for
 * confirmation. Renders nothing when no action is available.
 *
 * `children` adds your own menu items above the shared ones.
 */
export const ContentCommentActions = ({
  children,
  className,
  item,
  node,
}: {
  children?: React.ReactNode;
  className?: string;
  /** The comment's state from `useContentCommentItem`. */
  item: ContentCommentItemState;
  node: ContentCommentNode<unknown>;
}) => {
  const t = useTranslations("core.comments");
  const { comments, requestDelete, requestReport } =
    useContentCommentsContext();
  const showError = useContentCommentErrorToast();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [isHidePromptOpen, setIsHidePromptOpen] = React.useState(false);
  const [hidePromptOrigin, setHidePromptOrigin] =
    React.useState<MenuOrigin | null>(null);
  const { canDelete, canEdit, canHide, canReport } = item.permissions;
  const isHidden = node.hidden;
  const name =
    contentCommentAuthorName(contentCommentAuthor(node.record)) ??
    t("deleted_user");

  if (!node.record || (!canEdit && !canReport && !canHide && !canDelete)) {
    return children ? (
      <DropdownMenuShell
        className={className}
        label={t("more_actions", { name })}
      >
        {children}
      </DropdownMenuShell>
    ) : null;
  }

  const preload = () => {
    if (canEdit) preloadContentCommentComposer();
    if (canHide && !isHidden) void loadHideForm();
  };

  const changeVisibility = async (reason: null | string = null) => {
    const result = isHidden
      ? await comments.unhide(node.id)
      : await comments.hide(node.id, reason);
    if (!result.ok) {
      showError(result.status);

      return false;
    }

    const action = isHidden ? "unhide" : "hide";
    toast.success(t(`visibility.${action}.title`), {
      description: t(`visibility.${action}.desc`),
    });

    return true;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          onFocus={preload}
          onPointerEnter={preload}
          ref={triggerRef}
          render={
            <Button
              aria-label={t("more_actions", { name })}
              className={cn("text-muted-foreground font-semibold", className)}
              disabled={item.isAnyBusy && !item.isBusy}
              isLoading={item.isBusy}
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-44" ref={menuRef}>
          {children}
          {canEdit ? (
            <DropdownMenuItem
              onClick={() => {
                void item.startEditing();
              }}
            >
              <PencilIcon aria-hidden="true" />
              {t("edit")}
            </DropdownMenuItem>
          ) : null}
          {canReport ? (
            <DropdownMenuItem
              onClick={() => {
                requestReport(node);
              }}
            >
              <FlagIcon aria-hidden="true" />
              {t("report")}
            </DropdownMenuItem>
          ) : null}
          {(canHide || canDelete) && (canEdit || canReport || children) ? (
            <DropdownMenuSeparator />
          ) : null}
          {canHide ? (
            <DropdownMenuItem
              onClick={() => {
                if (isHidden) {
                  void changeVisibility();

                  return;
                }
                const rect = menuRef.current?.getBoundingClientRect();
                setHidePromptOrigin(
                  rect ? { height: rect.height, width: rect.width } : null,
                );
                setIsHidePromptOpen(true);
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
            <DropdownMenuItem
              onClick={() => {
                requestDelete(node);
              }}
              variant="destructive"
            >
              <Trash2Icon aria-hidden="true" />
              {t("delete.action")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canHide && !isHidden ? (
        <Popover onOpenChange={setIsHidePromptOpen} open={isHidePromptOpen}>
          <PopoverContent
            align="start"
            anchor={triggerRef}
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
              <PopoverTitle>{t("visibility.hide.prompt_title")}</PopoverTitle>
              <PopoverDescription>
                {t("visibility.hide.prompt_desc")}
              </PopoverDescription>
            </PopoverHeader>
            <LazyHideForm
              onCancel={() => {
                setIsHidePromptOpen(false);
              }}
              onHide={async reason => {
                if (await changeVisibility(reason)) {
                  setIsHidePromptOpen(false);
                }
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </>
  );
};

const DropdownMenuShell = ({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          aria-label={label}
          className={cn("text-muted-foreground font-semibold", className)}
          size="icon-xs"
          variant="ghost"
        />
      }
    >
      <EllipsisIcon aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent className="min-w-44">{children}</DropdownMenuContent>
  </DropdownMenu>
);
