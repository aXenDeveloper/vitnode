import type { ContentId } from "@/content/ids";

/**
 * One entry of a comment thread, as `GET /{publicApi.path}/thread` answers it:
 * a comment the reader may see, or a placeholder kept so its replies stay in
 * place.
 */
export interface ContentCommentNode<
  TRecord,
  TId extends ContentId = ContentId,
> {
  /**
   * Set for a comment that was deleted, or hidden from this reader, while it
   * still had replies: it stays as an anonymous placeholder - no text, no
   * author - dated when it was written. `byAuthor` tells whether its author
   * removed it rather than a moderator.
   */
  deleted: null | { byAuthor: boolean; createdAt: string };
  /** How deep it sits: 1 for a comment on the root record, 2 for a reply to it. */
  depth: number;
  /**
   * `true` for a hidden comment shown only because this reader may see it -
   * its author or a moderator. Never set for anyone else.
   */
  hidden: boolean;
  /** Why it was hidden, when a reason was given. Only with `hidden`. */
  hiddenReason: null | string;
  id: TId;
  parentId: null | TId;
  /** The public record, or `null` for a placeholder. */
  record: null | TRecord;
  removed: boolean;
}

/** One page of a thread, as `GET /{publicApi.path}/thread` answers it. */
export interface ContentCommentsThreadPage<
  TRecord,
  TId extends ContentId = ContentId,
> {
  items: ContentCommentNode<TRecord, TId>[];
  pageInfo: {
    endCursor: null | string;
    hasNextPage: boolean;
    /** Top-level comments in the whole thread. */
    totalCount: number;
  };
  /** Every public comment in the thread, at any depth. */
  replyCount: number;
  /** `true` when a page held more nested replies than one answer carries. */
  truncated: boolean;
}

/** A thread entry with the replies loaded below it. */
export interface ContentCommentTreeNode<
  TRecord,
  TId extends ContentId = ContentId,
> extends ContentCommentNode<TRecord, TId> {
  children: ContentCommentTreeNode<TRecord, TId>[];
}

/**
 * Turns the flat, depth-first entries of the loaded thread pages into a tree.
 * A reply whose parent is not loaded becomes a top-level entry rather than
 * disappearing. Pure.
 */
export const buildContentCommentTree = <TRecord, TId extends ContentId>(
  items: readonly ContentCommentNode<TRecord, TId>[],
): ContentCommentTreeNode<TRecord, TId>[] => {
  const nodes = new Map<string, ContentCommentTreeNode<TRecord, TId>>();
  const roots: ContentCommentTreeNode<TRecord, TId>[] = [];

  for (const item of items) {
    const node: ContentCommentTreeNode<TRecord, TId> = {
      ...item,
      children: [],
    };
    nodes.set(String(item.id), node);

    const parent =
      item.parentId === null ? undefined : nodes.get(String(item.parentId));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
};

/** Every reply below `node`, at any depth. Pure. */
export const countContentCommentReplies = <TRecord, TId extends ContentId>(
  node: ContentCommentTreeNode<TRecord, TId>,
): number =>
  node.children.reduce(
    (total, child) => total + 1 + countContentCommentReplies(child),
    0,
  );

/**
 * What a create or an edit became, read off the record the write route
 * answered with:
 *
 * - `pending`: it waits for a moderator - a new comment, or an edit proposal.
 * - `published`: it is public now.
 * - `draft`: saved, but not public and not waiting for anyone.
 *
 * Never announce `draft` or `pending` as posted. Pure.
 */
export type ContentCommentWriteOutcome = "draft" | "pending" | "published";

export const contentCommentWriteOutcome = (record: {
  approval: null | { status: string };
  status: string;
}): ContentCommentWriteOutcome => {
  if (record.approval?.status === "pending") return "pending";

  return record.status === "published" ? "published" : "draft";
};
