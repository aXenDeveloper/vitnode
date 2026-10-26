import { infiniteQueryOptions } from "@tanstack/react-query";
import {
  zodContentPublicPerson,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { useContentPermissions } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { blogQueryKeys } from "./post-query";

const COMMENTS_PAGE_SIZE = 20;

const zodRelationId = z
  .object({ id: z.number() })
  .transform(relation => relation.id);

const zodPerson = zodContentPublicPerson.nullable().catch(null);

export type CommentPerson = z.infer<typeof zodPerson>;

const zodComment = z.object({
  article: zodRelationId,
  author: zodPerson,
  body: zodRichTextDocument,
  createdAt: z.string(),
  id: z.number(),
  parent: zodRelationId.nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  updatedAt: z.string(),
});

export type PostComment = z.infer<typeof zodComment>;

const zodThreadPage = z.object({
  items: z.array(
    z.object({
      depth: z.number(),
      deleted: z
        .object({ byAuthor: z.boolean(), createdAt: z.string() })
        .nullable(),
      hidden: z.boolean(),
      hiddenReason: z.string().nullable(),
      id: z.number(),
      parentId: z.number().nullable(),
      record: zodComment.nullable(),
      removed: z.boolean(),
    }),
  ),
  pageInfo: z.object({
    endCursor: z.string().nullable(),
    hasNextPage: z.boolean(),
    totalCount: z.number(),
  }),
  replyCount: z.number(),
  truncated: z.boolean(),
});

type CommentsPage = z.infer<typeof zodThreadPage>;

export type CommentNode = CommentsPage["items"][number];

export interface CommentTreeNode extends CommentNode {
  children: CommentTreeNode[];
}

const fetchCommentsPage = async ({
  after,
  articleId,
}: {
  after: null | string;
  articleId: number;
}): Promise<CommentsPage> => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/comments",
    path: "/thread",
    args: {
      query: {
        root: String(articleId),
        first: COMMENTS_PAGE_SIZE,
        ...(after ? { after } : {}),
      },
    },
  });

  if (res.status !== 200) {
    throw new Error(`Loading the comments answered ${res.status}.`);
  }

  return zodThreadPage.parse(await res.json());
};

export const postCommentsQueryOptions = (articleId: number) =>
  infiniteQueryOptions({
    getNextPageParam: (last: CommentsPage) =>
      last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null,
    initialPageParam: null as null | string,
    queryFn: async ({ pageParam }) =>
      await fetchCommentsPage({ after: pageParam, articleId }),
    queryKey: blogQueryKeys.comments(articleId),
  });

export const buildCommentTree = (
  items: readonly CommentNode[],
): CommentTreeNode[] => {
  const nodes = new Map<number, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  for (const item of items) {
    const node: CommentTreeNode = { ...item, children: [] };
    nodes.set(item.id, node);

    const parent =
      item.parentId === null ? undefined : nodes.get(item.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

export const useCommentPermissions = (ids: readonly number[]) =>
  useContentPermissions({
    ids,
    queryKey: blogQueryKeys.commentPermissions,
    fetch: async request => {
      const res = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/permissions",
        args: { query: { ids: request.join(",") } },
      });
      if (res.status !== 200) throw new Error("Loading permissions failed.");

      return await res.json();
    },
  });

export const commentAnchorId = (commentSlug: string): string =>
  `comment-${commentSlug}`;
