/**
 * How a topic feed is ordered - the forum home and every forum page.
 *
 * - `hot`: engagement (points from reactions plus comments) on a log scale, with newer
 *   topics ahead, so a busy topic from this morning beats a busier one from
 *   last month.
 * - `new`: newest first.
 * - `active`: the latest comment (or the topic itself) first.
 * - `top`: the most points from reactions within {@link ForumFeedTopWindow}.
 */
export const FORUM_FEED_SORTS = ["hot", "new", "active", "top"] as const;

export type ForumFeedSort = (typeof FORUM_FEED_SORTS)[number];

export const FORUM_FEED_DEFAULT_SORT: ForumFeedSort = "hot";

/** How far back `top` looks, by publication time. */
export const FORUM_FEED_TOP_WINDOWS = [
  "day",
  "week",
  "month",
  "year",
  "all",
] as const;

export type ForumFeedTopWindow = (typeof FORUM_FEED_TOP_WINDOWS)[number];

export const FORUM_FEED_DEFAULT_TOP_WINDOW: ForumFeedTopWindow = "week";

export const FORUM_FEED_PAGE_SIZE = 25;

/**
 * A feed ranks at most this many pages of topics. Past it, readers reach older
 * topics through search or the `new` sort of a single forum.
 */
export const FORUM_FEED_MAX_PAGES = 40;

export const isForumFeedSort = (value: unknown): value is ForumFeedSort =>
  typeof value === "string" &&
  (FORUM_FEED_SORTS as readonly string[]).includes(value);

export const isForumFeedTopWindow = (
  value: unknown,
): value is ForumFeedTopWindow =>
  typeof value === "string" &&
  (FORUM_FEED_TOP_WINDOWS as readonly string[]).includes(value);

/**
 * How a topic's comments are ordered. Only top-level comments move; replies
 * stay in posting order under their parent, so a conversation reads top to
 * bottom.
 *
 * - `old`: posting order, like a classic forum - the default.
 * - `new`: newest first.
 * - `points`: most points from reactions first.
 */
export const FORUM_COMMENT_SORTS = ["old", "new", "points"] as const;

export type ForumCommentSort = (typeof FORUM_COMMENT_SORTS)[number];

export const FORUM_COMMENT_DEFAULT_SORT: ForumCommentSort = "old";

export const isForumCommentSort = (value: unknown): value is ForumCommentSort =>
  typeof value === "string" &&
  (FORUM_COMMENT_SORTS as readonly string[]).includes(value);
