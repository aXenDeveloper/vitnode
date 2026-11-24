import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { contentTarget } from "@vitnode/core/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReactionBar, ReactionPoints } from "@vitnode/core/tanstack/reactions";
import {
  ActivityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlameIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  PenSquareIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { ForumFeedSort } from "@/feed-sorts";

import { topicContentType } from "@/content/topic";
import {
  FORUM_FEED_DEFAULT_SORT,
  FORUM_FEED_DEFAULT_TOP_WINDOW,
  FORUM_FEED_SORTS,
  FORUM_FEED_TOP_WINDOWS,
} from "@/feed-sorts";
import { manifest } from "@/manifest.gen";

import type { FeedTopic, Forum } from "./forum-data";
import type { ForumSearch } from "./forum-links";

import { forumHref, topicHref, topicNewHref } from "./forum-links";
import { ForumIcon, PersonAvatar, PersonName, TimeAgo } from "./forum-ui";

const SORT_ICONS: Record<ForumFeedSort, typeof FlameIcon> = {
  active: ActivityIcon,
  hot: FlameIcon,
  new: SparklesIcon,
  top: TrophyIcon,
};

/** Builds the URL of the same feed with another sort, window or page. */
export type FeedHref = (search: ForumSearch) => string;

export const FeedSortNav = ({
  hrefFor,
  search,
}: {
  hrefFor: FeedHref;
  search: ForumSearch;
}) => {
  const t = useTranslations("@vitnode/forum.forums.feed");
  const sort = search.sort ?? FORUM_FEED_DEFAULT_SORT;
  const window = search.t ?? FORUM_FEED_DEFAULT_TOP_WINDOW;

  return (
    <nav aria-label={t("sort.label")} className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-center gap-1">
        {FORUM_FEED_SORTS.map(item => {
          const Icon = SORT_ICONS[item];
          const isActive = item === sort;

          return (
            <li key={item}>
              <HrefLink
                aria-current={isActive ? "true" : undefined}
                className={buttonVariants({
                  size: "sm",
                  variant: isActive ? "secondary" : "ghost",
                })}
                href={hrefFor({ sort: item })}
              >
                <Icon aria-hidden="true" />
                {t(`sort.${item}`)}
              </HrefLink>
            </li>
          );
        })}
      </ul>

      {sort === "top" ? (
        <ul
          aria-label={t("window.label")}
          className="flex flex-wrap items-center gap-1"
        >
          {FORUM_FEED_TOP_WINDOWS.map(item => {
            const isActive = item === window;

            return (
              <li key={item}>
                <HrefLink
                  aria-current={isActive ? "true" : undefined}
                  className={buttonVariants({
                    size: "xs",
                    variant: isActive ? "outline" : "ghost",
                  })}
                  href={hrefFor({ sort: "top", t: item })}
                >
                  {t(`window.${item}`)}
                </HrefLink>
              </li>
            );
          })}
        </ul>
      ) : null}
    </nav>
  );
};

/**
 * A wrapping line of meta items with a dot between them. Every item carries a
 * leading dot and the line is shifted left by one dot and clipped, so no line -
 * the first, or one after a wrap - starts with a stray dot.
 */
const MetaLine = ({ children }: { children: React.ReactNode }) => (
  <div className="text-muted-foreground overflow-hidden text-sm leading-relaxed">
    <p className="-ms-6 flex flex-wrap items-center gap-y-1">{children}</p>
  </div>
);

const MetaItem = ({ children }: { children: React.ReactNode }) => (
  <span className="flex min-w-0 items-center before:w-6 before:shrink-0 before:text-center before:content-['·']">
    <span className="flex min-w-0 items-center gap-2">{children}</span>
  </span>
);

const FeedCard = ({
  forum,
  topic,
}: {
  /** The topic's forum, shown beside the title; omit on the forum's own page. */
  forum?: Forum;
  topic: FeedTopic;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const titleId = `feed-topic-${topic.id}`;
  const target = contentTarget(manifest.id, topicContentType, topic.id);

  return (
    <li>
      <article
        aria-labelledby={titleId}
        className="bg-card flex flex-col rounded-xl border shadow-xs"
      >
        <div className="flex gap-4 p-4 md:p-5">
          {forum ? (
            <HrefLink
              aria-hidden="true"
              className="hidden shrink-0 sm:block"
              href={forumHref(forum.slug)}
              tabIndex={-1}
            >
              <ForumIcon icon={forum.metadata.icon} />
            </HrefLink>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <MetaLine>
              {forum ? (
                <MetaItem>
                  <HrefLink
                    className="text-foreground font-semibold underline-offset-4 hover:underline"
                    href={forumHref(forum.slug)}
                  >
                    {forum.name}
                  </HrefLink>
                </MetaItem>
              ) : null}
              <MetaItem>
                <PersonAvatar person={topic.author} size={24} />
                <span className="flex min-w-0">
                  <PersonName person={topic.author} />
                </span>
              </MetaItem>
              {topic.publishedAt ? (
                <MetaItem>
                  <TimeAgo date={topic.publishedAt} />
                </MetaItem>
              ) : null}
            </MetaLine>

            <h3
              className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance"
              id={titleId}
            >
              <HrefLink
                className="underline-offset-4 hover:underline"
                href={topicHref(topic.slug)}
              >
                {topic.title}
              </HrefLink>
            </h3>

            {topic.excerpt ? (
              <p className="text-muted-foreground line-clamp-3 leading-relaxed text-pretty break-words">
                {topic.excerpt}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 md:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <ReactionPoints initial={topic.points} target={target} />
            <ReactionBar target={target} />
          </div>
          <HrefLink
            className={buttonVariants({ size: "sm", variant: "ghost" })}
            href={`${topicHref(topic.slug)}#comments`}
          >
            <MessageSquareIcon aria-hidden="true" />
            {t("comment_count", { count: topic.commentCount })}
          </HrefLink>
        </footer>
      </article>
    </li>
  );
};

/**
 * A ranked page of topics, one card each: the forum's icon beside it, forum,
 * author and age on top, the title and a short excerpt, then a footer with its
 * points and reactions - react right from the feed - and a link to its
 * comments.
 */
export const TopicFeed = ({
  forumId,
  forums,
  search,
  topics,
}: {
  /** The forum the feed belongs to; its "new topic" link starts there. */
  forumId?: number;
  /** Forums by id, to label each topic. Omit when the feed is one forum's. */
  forums?: ReadonlyMap<number, Forum>;
  search: ForumSearch;
  topics: FeedTopic[];
}) => {
  const t = useTranslations("@vitnode/forum.forums");

  if (topics.length === 0) {
    const isTopWindow =
      search.sort === "top" &&
      (search.t ?? FORUM_FEED_DEFAULT_TOP_WINDOW) !== "all";

    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessagesSquareIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle render={<h3 />}>
            {isTopWindow ? t("feed.empty_top.title") : t("empty_forum.title")}
          </EmptyTitle>
          <EmptyDescription>
            {isTopWindow ? t("feed.empty_top.desc") : t("empty_forum.desc")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <HrefLink
            className={buttonVariants({ variant: "outline" })}
            href={topicNewHref(forumId)}
          >
            <PenSquareIcon aria-hidden="true" />
            {t("new_topic")}
          </HrefLink>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {topics.map(topic => (
        <FeedCard
          forum={forums?.get(topic.forum)}
          key={topic.id}
          topic={topic}
        />
      ))}
    </ul>
  );
};

export const FeedPagination = ({
  hasNextPage,
  hrefFor,
  search,
}: {
  hasNextPage: boolean;
  hrefFor: FeedHref;
  search: ForumSearch;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const page = search.page ?? 1;

  if (page === 1 && !hasNextPage) return null;

  return (
    <nav
      aria-label={t("pagination")}
      className="flex flex-wrap items-center justify-between gap-2"
    >
      {page > 1 ? (
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={hrefFor({ ...search, page: page - 1 })}
          rel="prev"
        >
          <ChevronLeftIcon aria-hidden="true" />
          {t("feed.previous")}
        </HrefLink>
      ) : (
        <span aria-hidden="true" />
      )}
      <span className="text-muted-foreground text-sm tabular-nums">
        {t("feed.page", { page })}
      </span>
      {hasNextPage ? (
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={hrefFor({ ...search, page: page + 1 })}
          rel="next"
        >
          {t("feed.next")}
          <ChevronRightIcon aria-hidden="true" />
        </HrefLink>
      ) : (
        <span aria-hidden="true" />
      )}
    </nav>
  );
};
