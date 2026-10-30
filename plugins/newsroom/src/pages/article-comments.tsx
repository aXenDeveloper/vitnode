import { contentTarget } from "@vitnode/core/content";
import {
  ContentComments,
  contentCommentsQueryOptions,
  useContentComments,
} from "@vitnode/core/tanstack/comments";
import { fetcher } from "@vitnode/core/tanstack/fetcher";

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

export const ArticleComments = ({ articleId }: { articleId: number }) => {
  const comments = useContentComments({
    ...articleCommentsThread(articleId),
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
  });

  return <ContentComments className="border-t pt-8" comments={comments} />;
};
