import {
  contentTarget,
  zodContentPublicPerson,
  zodRichTextDocument,
} from "@vitnode/core/content";
import {
  ContentComments,
  contentCommentsQueryOptions,
  useContentComments,
} from "@vitnode/core/tanstack/comments";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { commentContentType, FORUM_COMMENT_MAX_DEPTH } from "@/content/comment";
import { manifest } from "@/manifest.gen";

import { topicHref } from "./forum-links";
import { forumQueryKeys, invalidateForumCounts } from "./forum-queries";

/** A to-one relation as the public API projects it: `{ id }`, read as the bare id. */
export const zodRelationId = z
  .object({ id: z.number() })
  .transform(relation => relation.id);

const zodTopicComment = z.object({
  author: zodContentPublicPerson.nullable().catch(null),
  body: zodRichTextDocument,
  createdAt: z.string(),
  id: z.number(),
  parent: zodRelationId.nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  topic: zodRelationId,
  updatedAt: z.string(),
});

/** The thread under one topic, shared by the page's loader and its section. */
const topicCommentsThread = (topicId: number) => ({
  queryKey: forumQueryKeys.thread(topicId),
  record: zodTopicComment,
  thread: async ({ after, first }: { after: null | string; first: number }) =>
    await fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/comments",
      path: "/thread",
      args: {
        query: { root: String(topicId), first, ...(after ? { after } : {}) },
      },
    }),
});

/** Warms the first page of comments in the topic page's loader. */
export const topicCommentsQueryOptions = (topicId: number) =>
  contentCommentsQueryOptions(topicCommentsThread(topicId));

/**
 * A topic's comments in the shared Content Engine look - the same cards as
 * blog and news comments - with each comment's points from reactions, the
 * topic starter's **Author** badge and the edit history. Writes also refresh
 * the forum's counts and topic lists.
 */
export const TopicComments = ({
  canComment,
  starterId,
  topicId,
  topicSlug,
  topicTitle,
}: {
  /** Whether the forum's access rules let this reader comment. */
  canComment: boolean;
  starterId: null | number;
  topicId: number;
  topicSlug: string;
  topicTitle: string;
}) => {
  const comments = useContentComments({
    ...topicCommentsThread(topicId),
    allowed: canComment,
    maxDepth: FORUM_COMMENT_MAX_DEPTH,
    branches: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/thread/branches",
        args: {
          query: {
            root: String(topicId),
            ...(ids.length > 0 ? { ids: ids.join(",") } : {}),
          },
        },
      }),
    live: { contentTypeId: commentContentType.id, rootId: topicId },
    permissions: async ids =>
      await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/permissions",
        args: { query: { ids: ids.join(",") } },
      }),
    onChanged: invalidateForumCounts,
    create: async ({ body, parentId }) =>
      await fetcher({
        plugin: manifest.id,
        method: "post",
        module: "content/comments",
        path: "/",
        args: { body: { values: { body, parent: parentId, topic: topicId } } },
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
      // Comments keep revisions, so a stale version gets the conflict alert.
      save: async (id, { body, expectedVersion = 0 }) =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/comments",
          path: "/{id}",
          args: { params: { id }, body: { values: { body }, expectedVersion } },
        }),
    },
    history: {
      list: async id =>
        await fetcher({
          plugin: manifest.id,
          method: "get",
          module: "content/comments",
          path: "/{id}/history",
          args: { params: { id } },
        }),
      entry: async (id, revisionId) =>
        await fetcher({
          plugin: manifest.id,
          method: "get",
          module: "content/comments",
          path: "/{id}/history/{revisionId}",
          args: { params: { id, revisionId } },
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
    report: id => contentTarget(manifest.id, commentContentType, id),
    reactions: id => contentTarget(manifest.id, commentContentType, id),
  });

  return (
    <ContentComments
      anchorKey={comment => comment.slug}
      authorIds={starterId === null ? [] : [starterId]}
      comments={comments}
      permalink={anchorId => `${topicHref(topicSlug)}#${anchorId}`}
      points
      shareTitle={topicTitle}
    />
  );
};
