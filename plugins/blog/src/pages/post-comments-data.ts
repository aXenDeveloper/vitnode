import {
  contentTarget,
  zodContentPublicPerson,
  zodRichTextDocument,
} from "@vitnode/core/content";
import {
  CONTENT_COMMENT_ANCHOR_PREFIX,
  useContentComments,
} from "@vitnode/core/tanstack/comments";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import {
  BLOG_COMMENT_MAX_DEPTH,
  blogCommentContentType,
} from "@/content/comment";
import { manifest } from "@/manifest.gen";

import { blogQueryKeys } from "./post-query";

const zodRelationId = z
  .object({ id: z.number() })
  .transform(relation => relation.id);

const zodPostComment = z.object({
  article: zodRelationId,
  author: zodContentPublicPerson.nullable().catch(null),
  body: zodRichTextDocument,
  createdAt: z.string(),
  id: z.number(),
  parent: zodRelationId.nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  updatedAt: z.string(),
});

/** One comment's public record, as the thread serves it. */
export type PostComment = z.infer<typeof zodPostComment>;

/**
 * The comment thread under one article, wired to the blog's typed comment
 * routes: replies, editing with revisions, deleting, hiding and reports - and
 * kept current live, re-reading only the branches that changed.
 */
export const usePostComments = (articleId: number, canComment = true) =>
  useContentComments({
    // Every category of the article has to allow comments; the server checks
    // again when one is posted.
    allowed: canComment,
    queryKey: blogQueryKeys.comments(articleId),
    maxDepth: BLOG_COMMENT_MAX_DEPTH,
    record: zodPostComment,
    thread: async ({ after, first }) =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/thread",
        args: {
          query: {
            root: String(articleId),
            first,
            ...(after ? { after } : {}),
          },
        },
      }),
    branches: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/thread/branches",
        args: {
          query: {
            root: String(articleId),
            ...(ids.length > 0 ? { ids: ids.join(",") } : {}),
          },
        },
      }),
    live: { contentTypeId: blogCommentContentType.id, rootId: articleId },
    permissions: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/permissions",
        args: { query: { ids: ids.join(",") } },
      }),
    create: async ({ body, parentId }) =>
      await fetcher({
        plugin: manifest.id,
        method: "post",
        module: "content/comments",
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
          module: "content/comments",
          path: "/{id}/edit",
          args: { params: { id } },
        }),
      // Comments keep revisions, so the editable values always carry a
      // version; a stale one is answered with the conflict alert.
      save: async (id, { body, expectedVersion = 0 }) =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/comments",
          path: "/{id}",
          args: {
            params: { id },
            body: { values: { body }, expectedVersion },
          },
        }),
    },
    delete: async id =>
      await fetcher({
        plugin: manifest.id,
        method: "post",
        module: "content/comments",
        path: "/{id}/delete",
        args: { params: { id } },
      }),
    visibility: {
      hide: async (id, { reason }) =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/comments",
          path: "/{id}/hide",
          args: { params: { id }, body: reason ? { reason } : {} },
        }),
      unhide: async id =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/comments",
          path: "/{id}/unhide",
          args: { params: { id } },
        }),
    },
    report: id => contentTarget(manifest.id, blogCommentContentType, id),
  });

/** The element id a comment's permalink scrolls to: `comment-{slug}`. */
export const commentAnchorId = (commentSlug: string): string =>
  `${CONTENT_COMMENT_ANCHOR_PREFIX}${commentSlug}`;
