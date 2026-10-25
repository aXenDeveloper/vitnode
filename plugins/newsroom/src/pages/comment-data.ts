import { infiniteQueryOptions } from "@tanstack/react-query";
import {
  zodContentPublicPerson,
  zodRichTextDocument,
} from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

/** Top-level comments per page. The thread route accepts 1 to 50. */
const COMMENTS_PAGE_SIZE = 20;

/** One comment as `publicApi.fields` and `people` return it. */
const zodComment = z.object({
  author: zodContentPublicPerson.nullable().catch(null),
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
});

const zodCommentPage = z.object({
  items: z.array(
    z.object({
      depth: z.number(),
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

export type CommentPage = z.infer<typeof zodCommentPage>;

export type CommentItem = CommentPage["items"][number];

export type ArticleComment = NonNullable<CommentItem["record"]>;

const fetchCommentPage = async (articleId: number, after?: string) => {
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
  if (res.status !== 200) throw new Error("Loading the comments failed.");

  // The thread route types `record` loosely, so parse it once here.
  return zodCommentPage.parse(await res.json());
};

export const commentsQueryKey = (articleId: number) =>
  [manifest.id, "comments", articleId] as const;

/** Every loaded page under one key, so a refetch reloads them all in order. */
export const commentsQueryOptions = (articleId: number) =>
  infiniteQueryOptions({
    getNextPageParam: (last: CommentPage) =>
      last.pageInfo.hasNextPage
        ? (last.pageInfo.endCursor ?? undefined)
        : undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      await fetchCommentPage(articleId, pageParam),
    queryKey: commentsQueryKey(articleId),
  });

export interface CommentNode extends CommentItem {
  children: CommentNode[];
}

/** The flat, depth-first answer as a tree: a parent always comes before its replies. */
export const buildCommentTree = (
  items: readonly CommentItem[],
): CommentNode[] => {
  const nodes = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  for (const item of items) {
    const node: CommentNode = { ...item, children: [] };
    nodes.set(item.id, node);
    const parent =
      item.parentId === null ? undefined : nodes.get(item.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};
