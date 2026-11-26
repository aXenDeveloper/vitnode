import type { InfiniteData } from "@tanstack/react-query";

import { RichTextContent } from "@vitnode/core/components/rich-text";
import { contentTarget, zodRichTextDocument } from "@vitnode/core/content";
import {
  autoTranslateItem,
  AutoTranslateNote,
  useAutoTranslation,
} from "@vitnode/core/tanstack/auto-translate";
import {
  ContentComments,
  contentCommentsQueryOptions,
  useContentComments,
} from "@vitnode/core/tanstack/comments";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useMemo } from "react";
import { z } from "zod";

import { COMMENT_MAX_DEPTH, commentContentType } from "@/content/comment";
import { manifest } from "@/manifest.gen";

/** The thread under one article, shared by the page's loader and its section. */
const articleCommentsThread = (articleId: number) => ({
  queryKey: [manifest.id, "comments", articleId],
  thread: async ({ after, first }: { after: null | string; first: number }) =>
    await fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/article-comments",
      path: "/thread",
      args: {
        query: { root: String(articleId), first, ...(after ? { after } : {}) },
      },
    }),
});

/** Warms the first page of comments in the article page's loader. */
export const articleCommentsQueryOptions = (articleId: number) =>
  contentCommentsQueryOptions(articleCommentsThread(articleId));

type ArticleCommentsData = InfiniteData<
  Awaited<
    ReturnType<
      NonNullable<ReturnType<typeof articleCommentsQueryOptions>["queryFn"]>
    >
  >
>;
type ArticleCommentRecord = NonNullable<
  ArticleCommentsData["pages"][number]["items"][number]["record"]
>;

const zodTranslatableComment = z.object({
  body: zodRichTextDocument,
  id: z.number(),
});

const translatableComment = (record: ArticleCommentRecord) => {
  const parsed = zodTranslatableComment.safeParse(record);

  return parsed.success ? parsed.data : null;
};

/** The loaded comments, as the loader's translation snapshot names them. */
export const articleCommentAutoTranslateItems = (
  data: ArticleCommentsData | null,
) =>
  (data?.pages ?? []).flatMap(page =>
    page.items.flatMap(node => {
      const comment = node.record ? translatableComment(node.record) : null;

      return comment
        ? [
            autoTranslateItem(commentContentType.id, comment.id, {
              body: comment.body,
            }),
          ]
        : [];
    }),
  );

const CommentBody = ({ record }: { record: ArticleCommentRecord }) => {
  const comment = useMemo(() => translatableComment(record), [record]);

  return comment ? <TranslatedCommentBody {...comment} /> : null;
};

const TranslatedCommentBody = ({
  body,
  id,
}: z.infer<typeof zodTranslatableComment>) => {
  const { elementRef, ...translation } = useAutoTranslation({
    contentTypeId: commentContentType.id,
    fields: { body },
    id,
  });

  return (
    <div className="flex flex-col gap-1" ref={elementRef}>
      <RichTextContent
        className="text-foreground leading-relaxed text-pretty"
        content={translation.values.body}
      />
      <AutoTranslateNote translation={translation} />
    </div>
  );
};

export const ArticleComments = ({ articleId }: { articleId: number }) => {
  const comments = useContentComments({
    ...articleCommentsThread(articleId),
    autoTranslate: record => {
      const comment = translatableComment(record);

      return comment
        ? autoTranslateItem(commentContentType.id, comment.id, {
            body: comment.body,
          })
        : null;
    },
    maxDepth: COMMENT_MAX_DEPTH,
    branches: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/article-comments",
        path: "/thread/branches",
        args: {
          query: {
            root: String(articleId),
            ...(ids.length > 0 ? { ids: ids.join(",") } : {}),
          },
        },
      }),
    live: { contentTypeId: commentContentType.id, rootId: articleId },
    permissions: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/article-comments",
        path: "/permissions",
        args: { query: { ids: ids.join(",") } },
      }),
    create: async ({ body, parentId }) =>
      await fetcher({
        plugin: manifest.id,
        method: "post",
        module: "content/article-comments",
        path: "/",
        args: {
          body: { values: { article: articleId, body, parent: parentId } },
        },
      }),
    edit: {
      load: async id =>
        await fetcher({
          plugin: manifest.id,
          method: "get",
          module: "content/article-comments",
          path: "/{id}/edit",
          args: { params: { id } },
        }),
      // Comments have no editorial revisions, so the last save wins.
      save: async (id, { body }) =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/article-comments",
          path: "/{id}",
          args: { params: { id }, body: { values: { body } } },
        }),
    },
    delete: async id =>
      await fetcher({
        plugin: manifest.id,
        method: "post",
        module: "content/article-comments",
        path: "/{id}/delete",
        args: { params: { id } },
      }),
    visibility: {
      hide: async (id, { reason }) =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/article-comments",
          path: "/{id}/hide",
          args: { params: { id }, body: reason ? { reason } : {} },
        }),
      unhide: async id =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/article-comments",
          path: "/{id}/unhide",
          args: { params: { id } },
        }),
    },
    report: id => contentTarget(manifest.id, commentContentType, id),
    reactions: id => contentTarget(manifest.id, commentContentType, id),
  });

  return (
    <ContentComments
      className="border-t pt-8"
      comments={comments}
      render={{ body: record => <CommentBody record={record} /> }}
    />
  );
};
