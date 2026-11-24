import { zodRichTextDocument } from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import type { ForumCommentSort } from "@/feed-sorts";

import { FORUM_COMMENT_DEFAULT_SORT } from "@/feed-sorts";
import { manifest } from "@/manifest.gen";

import { zodPerson } from "./forum-data";

export const THREAD_PAGE_SIZE = 20;

/** `CONTENT_PUBLIC_MAX_PAGE_SIZE` - the most top-level comments one read carries. */
export const THREAD_MAX_PAGE_SIZE = 50;

/** A to-one relation as the public API projects it: `{ id }`, read as the bare id. */
export const zodRelationId = z
  .object({ id: z.number() })
  .transform(relation => relation.id);

const zodComment = z.object({
  author: zodPerson,
  body: zodRichTextDocument,
  createdAt: z.string(),
  id: z.number(),
  parent: zodRelationId.nullable(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  topic: zodRelationId,
  updatedAt: z.string(),
});

export type ThreadComment = z.infer<typeof zodComment>;

const zodThreadNode = z.object({
  depth: z.number(),
  id: z.number(),
  parentId: z.number().nullable(),
  record: zodComment.nullable(),
  removed: z.boolean(),
});

const zodThreadPage = z
  .object({
    items: z.array(zodThreadNode),
    pageInfo: z.object({
      endCursor: z.string().nullable(),
      hasNextPage: z.boolean(),
      totalCount: z.number(),
    }),
    replyCount: z.number(),
    truncated: z.boolean(),
  })
  .transform(({ replyCount, ...page }) => ({
    ...page,
    commentCount: replyCount,
  }));

export type ThreadPage = z.infer<typeof zodThreadPage>;

export type ThreadNode = ThreadPage["items"][number];

export const fetchThreadPage = async ({
  after,
  first = THREAD_PAGE_SIZE,
  topicId,
}: {
  after?: string;
  first?: number;
  topicId: number;
}): Promise<null | ThreadPage> => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/comments",
    path: "/thread",
    args: {
      query: {
        root: String(topicId),
        first: Math.min(Math.max(first, 1), THREAD_MAX_PAGE_SIZE),
        ...(after ? { after } : {}),
      },
    },
  });

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error("Loading the comments failed.");

  return zodThreadPage.parse(await res.json());
};

/** `CONTENT_THREAD_BRANCHES_MAX` - the most branches one `/thread/branches` read takes. */
const THREAD_BRANCHES_PER_READ = 10;

const zodBranches = z.object({
  branches: z.array(
    z.discriminatedUnion("status", [
      z.object({
        id: z.number(),
        items: z.array(zodThreadNode),
        status: z.literal("ok"),
      }),
      z.object({ id: z.number(), status: z.literal("gone") }),
    ]),
  ),
  replyCount: z.number(),
  truncated: z.boolean(),
});

const fetchBranches = async (topicId: number, ids: readonly number[]) => {
  const res = await fetcher({
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
  });

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error("Loading the comments failed.");

  return zodBranches.parse(await res.json());
};

/**
 * One page of a thread with its top-level comments in `sort` order: the forum
 * ranks the ids, then the Content Engine reads those branches with every
 * visibility rule, ten at a time. Same shape as {@link fetchThreadPage}; the
 * cursor is an offset.
 */
const fetchOrderedThreadPage = async ({
  after,
  first = THREAD_PAGE_SIZE,
  sort,
  topicId,
}: {
  after?: string;
  first?: number;
  sort: Exclude<ForumCommentSort, "old">;
  topicId: number;
}): Promise<null | ThreadPage> => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "forum",
    path: "/topics/{id}/comments/order",
    args: {
      params: { id: topicId },
      query: {
        after: after ? Number(after) : 0,
        first: Math.min(Math.max(first, 1), THREAD_MAX_PAGE_SIZE),
        sort,
      },
    },
  });

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error("Loading the comments failed.");

  const { ids, pageInfo } = await res.json();
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += THREAD_BRANCHES_PER_READ) {
    chunks.push(ids.slice(index, index + THREAD_BRANCHES_PER_READ));
  }
  const reads = await Promise.all(
    (chunks.length > 0 ? chunks : [[]]).map(
      async chunk => await fetchBranches(topicId, chunk),
    ),
  );
  if (reads.some(read => read === null)) return null;
  const answered = reads.filter(read => read !== null);

  return {
    commentCount: answered[0]?.replyCount ?? 0,
    items: answered.flatMap(read =>
      read.branches.flatMap(branch =>
        branch.status === "ok" ? branch.items : [],
      ),
    ),
    pageInfo,
    truncated: answered.some(read => read.truncated),
  };
};

/** One page of a topic's thread in `sort` order (`old` is posting order). */
export const fetchSortedThreadPage = async ({
  sort = FORUM_COMMENT_DEFAULT_SORT,
  ...request
}: {
  after?: string;
  first?: number;
  sort?: ForumCommentSort;
  topicId: number;
}): Promise<null | ThreadPage> =>
  sort === "old"
    ? await fetchThreadPage(request)
    : await fetchOrderedThreadPage({ ...request, sort });

export interface ThreadTreeNode extends ThreadNode {
  children: ThreadTreeNode[];
}

/** The flat, depth-first page as the tree it describes. */
export const buildThreadTree = (
  items: readonly ThreadNode[],
): ThreadTreeNode[] => {
  const nodes = new Map<number, ThreadTreeNode>();
  const roots: ThreadTreeNode[] = [];

  for (const item of items) {
    const node: ThreadTreeNode = { ...item, children: [] };
    nodes.set(item.id, node);

    const parent =
      item.parentId === null ? undefined : nodes.get(item.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

/**
 * Every node's descendant count, keyed by id, in one walk of the tree - a
 * recount per node would make a deep thread quadratic.
 */
export const countDescendants = (
  roots: readonly ThreadTreeNode[],
): ReadonlyMap<number, number> => {
  const counts = new Map<number, number>();
  const visit = (node: ThreadTreeNode): number => {
    let total = 0;
    for (const child of node.children) total += 1 + visit(child);
    counts.set(node.id, total);

    return total;
  };

  for (const root of roots) visit(root);

  return counts;
};
