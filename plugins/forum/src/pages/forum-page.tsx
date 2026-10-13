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
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
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

import {
  fetchForumStats,
  fetchTopicStats,
  indexBy,
  zodTopicRow,
} from "./forum-data";
import { FORUM_HREF, forumHref, topicHref, topicNewHref } from "./forum-links";
import { ForumList } from "./forum-list";
import {
  ForumIcon,
  ForumShell,
  PersonAvatar,
  PersonName,
  TimeAgo,
} from "./forum-ui";

const PAGE_SIZE = 25;

const loadForum = async (slug: string, { cursor }: ForumSearch) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/forums",
    path: "/{idOrSlug}",
    args: { params: { idOrSlug: encodeURIComponent(slug) } },
  });

  if (detail.status !== 200 && detail.status !== 404) {
    throw new Error("Loading the forum failed.");
  }

  const { ancestors, children, container } = contentPageItem(
    detail.status === 200 ? await detail.json() : null,
  );

  // Spread rather than written inline: the generated list query types its
  // filters loosely, so an inline key reads as an excess property.
  const filters = { forum: String(container.id) };

  const [list, forumStats] = await Promise.all([
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/topics",
      path: "/",
      args: {
        query: {
          ...filters,
          first: String(PAGE_SIZE),
          ...(cursor ? { cursor } : {}),
        },
      },
    }),
    children.length > 0 ? fetchForumStats() : Promise.resolve([]),
  ]);

  if (list.status !== 200) throw new Error("Loading the topics failed.");

  const { edges, pageInfo } = await list.json();
  const topics = z.array(zodTopicRow).parse(edges);

  return {
    ancestors,
    children,
    container,
    forumStats,
    isFirstPage: cursor === undefined,
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    topicStats: await fetchTopicStats(topics.map(topic => topic.id)),
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
          <a
            className={buttonVariants({ variant: "outline" })}
            href={FORUM_HREF}
          >
            {t("back")}
          </a>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const ForumsCrumb = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return <>{t("title")}</>;
};

export const route = definePluginRoute<ForumPageData, ForumSearch>({
  load: async ({ params, search }) => await loadForum(params.slug, search),

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
          <BreadcrumbLink href={FORUM_HREF}>
            <ForumsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.ancestors.map(ancestor => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={forumHref(ancestor.slug)}>
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
  const replyCount = stats?.replyCount ?? 0;

  return (
    <li className="flex items-start gap-3 p-4">
      <PersonAvatar person={topic.author} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <a
            className="text-foreground font-medium text-balance hover:underline"
            href={topicHref(topic.slug)}
          >
            {topic.title}
          </a>
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
              {t("reply_count", { count: replyCount })}
            </span>
          </span>
          {stats?.lastReplyAt ? (
            <span className="sr-only md:not-sr-only">
              {t("last_reply")} <TimeAgo date={stats.lastReplyAt} />
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
        <a className={buttonVariants()} href={topicNewHref(container.id)}>
          <PenSquareIcon aria-hidden="true" />
          {t("new_topic")}
        </a>
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
              <a
                className={buttonVariants({ variant: "outline" })}
                href={topicNewHref(container.id)}
              >
                {t("new_topic")}
              </a>
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
              <a
                className={buttonVariants({ variant: "outline" })}
                href={forumHref(container.slug)}
              >
                {t("newest")}
              </a>
            )}
            {nextCursor === null ? null : (
              <a
                className={buttonVariants({ variant: "outline" })}
                href={forumHref(container.slug, { cursor: nextCursor })}
              >
                {t("older")}
              </a>
            )}
          </nav>
        )}
      </section>
    </ForumShell>
  );
};

export default ForumPage;
