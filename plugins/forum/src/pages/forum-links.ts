export const FORUM_HREF = "/forum";
export const FORUM_PENDING_HREF = "/forum/me/pending";

const CURSOR = /^[A-Za-z0-9_-]{1,512}$/;

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

export interface ForumSearch {
  cursor?: string;
}

export const forumSearch = (input: Record<string, unknown>): ForumSearch =>
  typeof input.cursor === "string" && CURSOR.test(input.cursor)
    ? { cursor: input.cursor }
    : {};

export const forumHref = (slug: string, { cursor }: ForumSearch = {}): string =>
  `${FORUM_HREF}/${encodeURIComponent(slug)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;

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

export interface TopicEditSearch {
  submitted?: true;
}

export const topicEditSearch = (
  input: Record<string, unknown>,
): TopicEditSearch => (isTrue(input.submitted) ? { submitted: true } : {});

export const topicEditHref = (
  id: number | string,
  { submitted }: TopicEditSearch = {},
): string =>
  `${FORUM_HREF}/topics/${encodeURIComponent(String(id))}/edit${submitted ? "?submitted=1" : ""}`;

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
