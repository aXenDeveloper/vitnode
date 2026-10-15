import { zodRichTextDocument } from "@vitnode/core/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

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

const zodThreadPage = z
  .object({
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

export const countDescendants = (node: ThreadTreeNode): number =>
  node.children.reduce(
    (total, child) => total + 1 + countDescendants(child),
    0,
  );
