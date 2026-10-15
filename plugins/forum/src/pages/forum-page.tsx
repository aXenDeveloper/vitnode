import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { queryOptions } from "@tanstack/react-query";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@vitnode/core/components/ui/breadcrumb";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import {
  MessageSquareIcon,
  MessagesSquareIcon,
  PenSquareIcon,
  SearchXIcon,
} from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import type { TopicRow, TopicStats } from "./forum-data";
import type { ForumSearch } from "./forum-links";

import { fetchTopicStats, indexBy, zodTopicRow } from "./forum-data";
import { FORUM_HREF, forumHref, topicHref, topicNewHref } from "./forum-links";
import { ForumList } from "./forum-list";
import {
  FORUM_ACTIVITY_STALE_TIME,
  forumQueryKeys,
  forumQueryOptions,
  forumStatsQueryOptions,
} from "./forum-queries";
import {
  ForumIcon,
  ForumShell,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from "./forum-ui";

const PAGE_SIZE = 25;

const forumTopicsQueryOptions = (request: ForumSearch & { forumId: number }) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      // Spread rather than written inline: the generated list query types its
      // filters loosely, so an inline key reads as an excess property.
      const filters = { forum: String(request.forumId) };

      const list = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "content/topics",
        path: "/",
        args: {
          query: {
            ...filters,
            first: String(PAGE_SIZE),
            ...(request.cursor ? { cursor: request.cursor } : {}),
          },
        },
      });

      if (list.status !== 200) throw new Error("Loading the topics failed.");

      const { edges, pageInfo } = await list.json();
      const topics = z.array(zodTopicRow).parse(edges);

      return {
        nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
        topicStats: await fetchTopicStats(topics.map(topic => topic.id)),
        topics,
      };
    },
    queryKey: forumQueryKeys.topicList(request),
    staleTime: FORUM_ACTIVITY_STALE_TIME,
  });

const loadForum = async (
  queryClient: QueryClient,
  slug: string,
  { cursor }: ForumSearch,
) => {
  const { ancestors, children, container } = contentPageItem(
    await queryClient.query(forumQueryOptions(slug)),
  );

  const [{ nextCursor, topicStats, topics }, forumStats] = await Promise.all([
    queryClient.query(
      forumTopicsQueryOptions({
        forumId: container.id,
        ...(cursor ? { cursor } : {}),
      }),
    ),
    children.length > 0
      ? queryClient.query(forumStatsQueryOptions())
      : Promise.resolve([]),
  ]);

  return {
    ancestors,
    children,
    container,
    forumStats,
    isFirstPage: cursor === undefined,
    nextCursor,
    topicStats,
    topics,
  };
};

type ForumPageData = Awaited<ReturnType<typeof loadForum>>;

const ForumNotFound = () => {
  const t = useTranslations("@vitnode/forum.forums.not_found");

  return (
    <div className="container mx-auto flex max-w-3xl px-4 py-8 md:py-12">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle render={<h1 />}>{t("title")}</EmptyTitle>
          <EmptyDescription>{t("desc")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <HrefLink
            className={buttonVariants({ variant: "outline" })}
            href={FORUM_HREF}
          >
            {t("back")}
          </HrefLink>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const ForumsCrumb = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return <>{t("title")}</>;
};

export const route = defineRoute<ForumPageData, ForumSearch>({
  load: async ({ context, params, search }) =>
    await loadForum(context.queryClient, params.slug, search),

  head: ({ loaderData, t }) => ({
    description:
      loaderData?.container.metadata.description ??
      t("@vitnode/forum.forums.forum_desc_fallback", {
        name: loaderData?.container.name ?? "",
      }),
    title: loaderData?.container.name,
  }),

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink render={<HrefLink href={FORUM_HREF} />}>
            <ForumsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.ancestors.map(ancestor => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<HrefLink href={forumHref(ancestor.slug)} />}
              >
                {ancestor.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Fragment>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{loaderData.container.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    ),
  },

  notFound: ForumNotFound,
});

const TopicListRow = ({
  stats,
  topic,
}: {
  stats: TopicStats | undefined;
  topic: TopicRow;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const commentCount = stats?.commentCount ?? 0;

  return (
    <li className="flex items-start gap-3 p-4">
      <PersonAvatar person={topic.author} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <HrefLink
            className="text-foreground font-medium text-balance hover:underline"
            href={topicHref(topic.slug)}
          >
            {topic.title}
          </HrefLink>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed">
            <PersonName person={topic.author} />
            {topic.publishedAt ? (
              <>
                <span aria-hidden="true">·</span>
                <TimeAgo date={topic.publishedAt} />
              </>
            ) : null}
          </p>
        </div>

        <p className="text-muted-foreground flex items-center gap-4 text-sm leading-relaxed md:w-48 md:justify-end">
          <span className="flex items-center gap-1.5">
            <MessageSquareIcon aria-hidden="true" className="size-4" />
            <span className="tabular-nums">
              {t("comment_count", { count: commentCount })}
            </span>
          </span>
          {stats?.lastCommentAt ? (
            <span className="sr-only md:not-sr-only">
              {t("last_comment")} <TimeAgo date={stats.lastCommentAt} />
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
};

const ForumPage = ({
  loaderData,
}: PluginRoutePageProps<ForumPageData, ForumSearch>) => {
  const t = useTranslations("@vitnode/forum.forums");
  const {
    children,
    container,
    forumStats,
    isFirstPage,
    nextCursor,
    topicStats,
    topics,
  } = loaderData;
  const statsOfTopic = indexBy(topicStats, item => item.topicId);

  return (
    <ForumShell
      actions={
        <HrefLink
          className={buttonVariants()}
          href={topicNewHref(container.id)}
        >
          <PenSquareIcon aria-hidden="true" />
          {t("new_topic")}
        </HrefLink>
      }
      description={container.metadata.description}
      title={
        <>
          <ForumIcon icon={container.metadata.icon} />
          {container.name}
        </>
      }
    >
      {children.length > 0 ? (
        <section
          aria-labelledby="forum-children"
          className="flex flex-col gap-4"
        >
          <h2
            className="text-foreground text-xl font-semibold text-balance"
            id="forum-children"
          >
            {t("subforums")}
          </h2>
          <ForumList
            label={t("subforums")}
            nodes={children.map(child => ({ ...child, children: [] }))}
            stats={indexBy(forumStats, item => item.forumId)}
          />
        </section>
      ) : null}

      <section aria-labelledby="forum-topics" className="flex flex-col gap-4">
        <h2
          className="text-foreground text-xl font-semibold text-balance"
          id="forum-topics"
        >
          {t("topics")}
        </h2>

        {topics.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle render={<h3 />}>{t("empty_forum.title")}</EmptyTitle>
              <EmptyDescription>{t("empty_forum.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={topicNewHref(container.id)}
              >
                {t("new_topic")}
              </HrefLink>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="bg-card flex flex-col divide-y rounded-xl border">
            {topics.map(topic => (
              <TopicListRow
                key={topic.id}
                stats={statsOfTopic.get(topic.id)}
                topic={topic}
              />
            ))}
          </ul>
        )}

        {isFirstPage && nextCursor === null ? null : (
          <nav
            aria-label={t("pagination")}
            className="flex flex-wrap items-center gap-2"
          >
            {isFirstPage ? null : (
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={forumHref(container.slug)}
              >
                {t("newest")}
              </HrefLink>
            )}
            {nextCursor === null ? null : (
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={forumHref(container.slug, { cursor: nextCursor })}
              >
                {t("older")}
              </HrefLink>
            )}
          </nav>
        )}
      </section>
    </ForumShell>
  );
};

export default ForumPage;
