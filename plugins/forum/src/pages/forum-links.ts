import type { ForumFeedSort, ForumFeedTopWindow } from "@/feed-sorts";

import {
  FORUM_FEED_DEFAULT_SORT,
  FORUM_FEED_DEFAULT_TOP_WINDOW,
  FORUM_FEED_MAX_PAGES,
  isForumFeedSort,
  isForumFeedTopWindow,
} from "@/feed-sorts";

export const FORUM_HREF = "/forum";
export const FORUM_PENDING_HREF = "/forum/me/pending";

const positiveId = (raw: unknown): number | undefined => {
  const value =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^[1-9]\d{0,15}$/.test(raw)
        ? Number(raw)
        : Number.NaN;

  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
};

const isTrue = (raw: unknown): boolean =>
  raw === true || raw === "true" || raw === 1 || raw === "1";

/**
 * The feed's place in the URL: `/forum` and `/forum/:slug` both take
 * `?sort=top&t=month&page=2`. Defaults stay out of the URL, so the plain
 * address is the canonical one.
 */
export interface ForumSearch {
  page?: number;
  sort?: ForumFeedSort;
  t?: ForumFeedTopWindow;
}

export const forumSearch = (input: Record<string, unknown>): ForumSearch => {
  const search: ForumSearch = {};
  const sort = isForumFeedSort(input.sort) ? input.sort : undefined;
  if (sort && sort !== FORUM_FEED_DEFAULT_SORT) search.sort = sort;
  if (
    sort === "top" &&
    isForumFeedTopWindow(input.t) &&
    input.t !== FORUM_FEED_DEFAULT_TOP_WINDOW
  ) {
    search.t = input.t;
  }
  const page = positiveId(input.page);
  if (page !== undefined && page > 1 && page <= FORUM_FEED_MAX_PAGES) {
    search.page = page;
  }

  return search;
};

const feedQueryString = ({ page, sort, t }: ForumSearch): string => {
  const params = new URLSearchParams();
  if (sort && sort !== FORUM_FEED_DEFAULT_SORT) params.set("sort", sort);
  if (sort === "top" && t && t !== FORUM_FEED_DEFAULT_TOP_WINDOW) {
    params.set("t", t);
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();

  return query ? `?${query}` : "";
};

/** The forum home feed, sorted and paged as `search` says. */
export const feedHref = (search: ForumSearch = {}): string =>
  `${FORUM_HREF}${feedQueryString(search)}`;

export const forumHref = (slug: string, search: ForumSearch = {}): string =>
  `${FORUM_HREF}/${encodeURIComponent(slug)}${feedQueryString(search)}`;

export interface TopicSearch {
  created?: true;
}

export const topicSearch = (input: Record<string, unknown>): TopicSearch =>
  isTrue(input.created) ? { created: true } : {};

export const topicHref = (
  slug: string,
  { created }: TopicSearch = {},
): string =>
  `${FORUM_HREF}/topics/${encodeURIComponent(slug)}${created ? "?created=true" : ""}`;

export const commentAnchorId = (commentSlug: string): string =>
  `comment-${commentSlug}`;

export const commentPermalink = (commentSlug: string): string =>
  `${FORUM_HREF}/comments/${encodeURIComponent(commentSlug)}`;

export interface TopicNewSearch {
  forum?: number;
}

export const topicNewSearch = (
  input: Record<string, unknown>,
): TopicNewSearch => {
  const forum = positiveId(input.forum);

  return forum === undefined ? {} : { forum };
};

export const topicNewHref = (forum?: number): string =>
  forum === undefined
    ? `${FORUM_HREF}/create/topic`
    : `${FORUM_HREF}/create/topic?forum=${forum}`;

export const topicEditHref = (id: number | string): string =>
  `${FORUM_HREF}/topics/${encodeURIComponent(String(id))}/edit`;

export interface PendingSearch {
  page?: number;
}

export const pendingSearch = (
  input: Record<string, unknown>,
): PendingSearch => {
  const page = positiveId(input.page);

  return page === undefined || page === 1 ? {} : { page };
};

export const pendingHref = (page = 1): string =>
  page <= 1 ? FORUM_PENDING_HREF : `${FORUM_PENDING_HREF}?page=${page}`;

export const loginHref = (returnTo: string): string =>
  `/login?returnTo=${encodeURIComponent(returnTo)}`;
