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
import { ReactionBar } from "@vitnode/core/tanstack/reactions";
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
import { ReactionPoints } from "./reaction-points";

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

const FeedCard = ({
  forum,
  topic,
}: {
  /** The topic's forum, shown above the title; omit on the forum's own page. */
  forum?: Forum;
  topic: FeedTopic;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const titleId = `feed-topic-${topic.id}`;
  const target = contentTarget(manifest.id, topicContentType, topic.id);

  return (
    <li className="hover:bg-muted/40 motion-safe:transition-colors">
      <article
        aria-labelledby={titleId}
        className="flex flex-col gap-2 p-4 md:px-5"
      >
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
          {forum ? (
            <>
              <HrefLink
                className="text-foreground flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                href={forumHref(forum.slug)}
              >
                <ForumIcon className="size-6" icon={forum.metadata.icon} />
                {forum.name}
              </HrefLink>
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          <span className="flex items-center gap-2">
            <PersonAvatar person={topic.author} size={24} />
            <PersonName person={topic.author} />
          </span>
          {topic.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <TimeAgo date={topic.publishedAt} />
            </>
          ) : null}
        </p>

        <h3
          className="text-foreground text-lg leading-snug font-semibold text-balance"
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
          <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed text-pretty break-words">
            {topic.excerpt}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ReactionPoints initial={topic.points} target={target} />
            <ReactionBar target={target} />
          </div>
          <ul className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm leading-relaxed">
            <li className="flex items-center gap-1.5">
              <MessageSquareIcon aria-hidden="true" className="size-4" />
              <span className="tabular-nums">
                {t("comment_count", { count: topic.commentCount })}
              </span>
            </li>
            {topic.commentCount > 0 && topic.lastActivityAt ? (
              <li className="flex items-center gap-1.5">
                <ActivityIcon aria-hidden="true" className="size-4" />
                <span>
                  {t("last_comment")} <TimeAgo date={topic.lastActivityAt} />
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </article>
    </li>
  );
};

/**
 * A ranked page of topics, Reddit-style: forum, author and age on top, the
 * title, a short excerpt, then its points and reactions - react right from the
 * feed - and the conversation around it.
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
    <ul className="bg-card flex flex-col divide-y overflow-hidden rounded-xl border">
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
