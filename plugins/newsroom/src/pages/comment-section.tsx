import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { type RichTextDocument } from "@vitnode/core/content";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { COMMENT_MAX_DEPTH } from "@/content/comment";
import { manifest } from "@/manifest.gen";

import type { CommentComposerProps, CommentOutcome } from "./comment-composer";
import type { ArticleComment, CommentNode } from "./comment-data";
import type { CommentEditorProps } from "./comment-editor";

import {
  buildCommentTree,
  commentsQueryKey,
  commentsQueryOptions,
} from "./comment-data";
import { useCommentPermissions } from "./comment-permissions";

// The editor is heavy and most readers never write, so it loads on demand.
const CommentComposer = lazy(async () => await import("./comment-composer"));
const CommentEditor = lazy(async () => await import("./comment-editor"));

const Composer = (props: CommentComposerProps) => (
  <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
    <CommentComposer {...props} />
  </Suspense>
);

/** Who wrote a comment, and what they said. */
const CommentBody = ({ comment }: { comment: ArticleComment }) => {
  const t = useTranslations("newsroom.comments");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {comment.author?.name ?? t("someone")}
      </p>
      <RichTextContent
        className="leading-relaxed text-pretty"
        content={comment.body}
      />
    </div>
  );
};

/** A comment, with Edit for the visitors who may use it. */
const CommentItem = ({
  canEdit,
  comment,
  onSaved,
}: {
  canEdit: boolean;
  comment: ArticleComment;
  onSaved: CommentEditorProps["onSaved"];
}) => {
  const t = useTranslations("newsroom.comments");
  const tWrite = useTranslations("core.global.content_write");
  const [editing, setEditing] = useState<null | RichTextDocument>(null);
  const [isOpening, setIsOpening] = useState(false);

  // Opens the editor on the comment's latest text, not on the cached copy.
  const openEditor = async () => {
    setIsOpening(true);
    try {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/{id}/edit",
        args: { params: { id: comment.id } },
      });
      if (res.status !== 200) {
        const reason =
          res.status === 401
            ? "unauthenticated"
            : res.status === 403
              ? "forbidden"
              : res.status === 404
                ? "not_found"
                : "unknown";
        toast.error(tWrite("title"), { description: tWrite(reason) });

        return;
      }

      setEditing((await res.json()).values.body);
    } finally {
      setIsOpening(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          {comment.author?.name ?? t("someone")}
        </p>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-lg" />}>
          <CommentEditor
            body={editing}
            commentId={comment.id}
            label={t("form.edit_label")}
            onCancel={() => {
              setEditing(null);
            }}
            onSaved={async pending => {
              setEditing(null);
              await onSaved(pending);
            }}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <CommentBody comment={comment} />
      {canEdit ? (
        <Button
          className="self-start"
          isLoading={isOpening}
          onClick={openEditor}
          size="sm"
          variant="ghost"
        >
          {t("edit")}
        </Button>
      ) : null}
    </div>
  );
};

/** What every comment in the tree needs from the section. */
interface CommentThread {
  articleId: number;
  canReply: boolean;
  onEdited: CommentEditorProps["onSaved"];
  onPosted: CommentComposerProps["onPosted"];
  permissions: ReturnType<typeof useCommentPermissions>;
}

/** A comment with its Reply form, followed by every answer below it. */
const CommentBranch = ({
  node,
  thread,
}: {
  node: CommentNode;
  thread: CommentThread;
}) => {
  const t = useTranslations("newsroom.comments");
  const [replying, setReplying] = useState(false);

  return (
    <li className="flex flex-col gap-3">
      {node.record ? (
        <>
          <CommentItem
            canEdit={thread.permissions.of(node.id).canEdit}
            comment={node.record}
            onSaved={thread.onEdited}
          />
          {thread.canReply && node.depth < COMMENT_MAX_DEPTH ? (
            <Button
              aria-expanded={replying}
              className="self-start"
              onClick={() => {
                setReplying(!replying);
              }}
              size="sm"
              variant="ghost"
            >
              {t("reply")}
            </Button>
          ) : null}
          {replying ? (
            <div className="flex flex-col gap-2">
              <Composer
                articleId={thread.articleId}
                label={t("form.reply_label", {
                  name: node.record.author?.name ?? t("someone"),
                })}
                onPosted={async outcome => {
                  setReplying(false);
                  await thread.onPosted(outcome);
                }}
                parentId={node.id}
              />
              <Button
                className="self-start"
                onClick={() => {
                  setReplying(false);
                }}
                size="sm"
                variant="ghost"
              >
                {t("form.cancel")}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        // Hidden, but its public answers still need a parent to hang from.
        <p className="text-muted-foreground text-sm italic">{t("removed")}</p>
      )}

      {node.children.length > 0 ? (
        <ol className="flex flex-col gap-4 border-l-2 pl-3 md:pl-6">
          {node.children.map(child => (
            <CommentBranch key={child.id} node={child} thread={thread} />
          ))}
        </ol>
      ) : null}
    </li>
  );
};

export const CommentSection = ({
  articleId,
  articleSlug,
}: {
  articleId: number;
  articleSlug: string;
}) => {
  const t = useTranslations("newsroom.comments");
  const queryClient = useQueryClient();
  const session = useSessionQuery();
  const [composerKey, setComposerKey] = useState(0);
  const comments = useInfiniteQuery(commentsQueryOptions(articleId));

  const pages = comments.data?.pages;
  const items = useMemo(
    () => pages?.flatMap(page => page.items) ?? [],
    [pages],
  );
  const tree = useMemo(() => buildCommentTree(items), [items]);
  // One request for every comment on screen, batched by the hook.
  const permissions = useCommentPermissions(
    items.flatMap(item => (item.record ? [item.id] : [])),
  );

  const onPosted = async (outcome: CommentOutcome) => {
    if (outcome !== "published") {
      // Not in the public thread, so there is nothing to refresh.
      toast.info(t(`${outcome}.title`), { description: t(`${outcome}.desc`) });

      return;
    }

    toast.success(t("created.title"), { description: t("created.desc") });
    // Refetches every loaded page in order, with the new count.
    await queryClient.invalidateQueries({
      queryKey: commentsQueryKey(articleId),
    });
  };

  const onEdited = async (pending: boolean) => {
    if (pending) {
      toast.info(t("edit_pending.title"), {
        description: t("edit_pending.desc"),
      });
    } else {
      toast.success(t("edited.title"), { description: t("edited.desc") });
    }
    await queryClient.invalidateQueries({
      queryKey: commentsQueryKey(articleId),
    });
  };

  const thread: CommentThread = {
    articleId,
    canReply: Boolean(session.data?.user),
    onEdited,
    onPosted,
    permissions,
  };

  return (
    <section aria-labelledby="comments-title" className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-balance" id="comments-title">
        {t("title", { count: pages?.[0]?.replyCount ?? 0 })}
      </h2>

      {comments.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-4">
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          {[0, 1].map(key => (
            <div className="flex flex-col gap-2" key={key}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : comments.isError && items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted-foreground leading-relaxed" role="alert">
            {t("load_failed.desc")}
          </p>
          <Button
            isLoading={comments.isFetching}
            onClick={async () => {
              await comments.refetch();
            }}
            variant="outline"
          >
            {t("retry")}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground leading-relaxed">{t("empty")}</p>
      ) : (
        <ol aria-busy={comments.isFetching} className="flex flex-col gap-6">
          {tree.map(node => (
            <CommentBranch key={node.id} node={node} thread={thread} />
          ))}
        </ol>
      )}

      {pages?.some(page => page.truncated) ? (
        <p className="text-muted-foreground text-sm">{t("truncated")}</p>
      ) : null}

      {comments.hasNextPage ? (
        <Button
          className="self-start"
          disabled={comments.isFetching}
          isLoading={comments.isFetchingNextPage}
          onClick={async () => {
            const next = await comments.fetchNextPage();
            if (next.isError) {
              toast.error(t("load_failed.title"), {
                description: t("load_failed.desc"),
              });
            }
          }}
          variant="outline"
        >
          {t("load_more")}
        </Button>
      ) : null}

      {session.data?.user ? (
        <Composer
          articleId={articleId}
          // A fresh key gives the next comment an empty editor.
          key={composerKey}
          label={t("form.label")}
          onPosted={async outcome => {
            setComposerKey(key => key + 1);
            await onPosted(outcome);
          }}
          parentId={null}
        />
      ) : (
        <HrefLink
          className={buttonVariants({
            className: "self-start",
            variant: "outline",
          })}
          href={`/login?returnTo=${encodeURIComponent(`/news/${articleSlug}`)}`}
        >
          {t("sign_in")}
        </HrefLink>
      )}
    </section>
  );
};
