import type { QueryClient } from "@tanstack/react-query";
import type { ContentContainerTreeNode } from "@vitnode/core/content";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { contentContainerTree } from "@vitnode/core/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { LockIcon, MessagesSquareIcon, PenSquareIcon } from "lucide-react";
import { useFormatter, useTranslations } from "use-intl";

import type { Forum, ForumStats } from "./forum-data";
import type { ForumSearch } from "./forum-links";

import { indexBy } from "./forum-data";
import { feedHref, forumHref, topicNewHref } from "./forum-links";
import {
  feedQueryOptions,
  forumsQueryOptions,
  forumStatsQueryOptions,
} from "./forum-queries";
import { ForumIcon, ForumShell } from "./forum-ui";
import { FeedPagination, FeedSortNav, TopicFeed } from "./topic-feed";

const loadForums = async (
  queryClient: QueryClient,
  locale: string,
  search: ForumSearch,
) => {
  const [forums, stats, feed] = await Promise.all([
    queryClient.query(forumsQueryOptions(locale)),
    queryClient.query(forumStatsQueryOptions()),
    queryClient.query(feedQueryOptions(search)),
  ]);

  return {
    feed,
    forums,
    search,
    stats,
    tree: contentContainerTree(forums),
  };
};

type ForumsPageData = Awaited<ReturnType<typeof loadForums>>;

const ForumsBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<ForumsPageData, ForumSearch>({
  load: async ({ context, search }) =>
    await loadForums(context.queryClient, context.locale, search),

  head: ({ t }) => ({
    description: t("@vitnode/forum.forums.desc"),
    title: t("@vitnode/forum.forums.title"),
  }),

  breadcrumb: ForumsBreadcrumb,
});

const SidebarForums = ({
  depth = 0,
  nodes,
  stats,
}: {
  depth?: number;
  nodes: ContentContainerTreeNode<Forum>[];
  stats: ReadonlyMap<number, ForumStats>;
}) => {
  const t = useTranslations("@vitnode/forum.forums");
  const format = useFormatter();

  return (
    <ul className="flex flex-col gap-1">
      {nodes.map(node => (
        <li className="flex flex-col gap-1" key={node.id}>
          <HrefLink
            className="hover:bg-muted focus-visible:ring-ring flex items-center gap-3 rounded-lg p-2 focus-visible:ring-2 focus-visible:outline-none"
            href={forumHref(node.slug)}
          >
            <ForumIcon
              className={depth === 0 ? "size-8" : "size-6"}
              icon={node.metadata.icon}
            />
            <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
              {node.name}
            </span>
            {node.access.canRead ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                <span className="sr-only">{t("stats.topics")}: </span>
                {format.number(stats.get(node.id)?.topicCount ?? 0)}
              </span>
            ) : (
              <LockIcon
                aria-label={t("members_only")}
                className="text-muted-foreground size-3.5"
                role="img"
              />
            )}
          </HrefLink>
          {node.children.length > 0 ? (
            <div className="border-border ms-6 border-s ps-2">
              <SidebarForums
                depth={depth + 1}
                nodes={node.children}
                stats={stats}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const ForumsPage = ({
  loaderData,
}: PluginRoutePageProps<ForumsPageData, ForumSearch>) => {
  const t = useTranslations("@vitnode/forum.forums");
  const { feed, forums, search, tree } = loaderData;
  const stats = indexBy(loaderData.stats, item => item.forumId);
  const forumsById = indexBy(forums, item => item.id);

  if (tree.length === 0) {
    return (
      <ForumShell description={t("desc")} title={t("title")}>
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessagesSquareIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h2 />}>{t("empty.title")}</EmptyTitle>
            <EmptyDescription>{t("empty.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href="/"
            >
              {t("empty.home")}
            </HrefLink>
          </EmptyContent>
        </Empty>
      </ForumShell>
    );
  }

  return (
    <ForumShell
      actions={
        <HrefLink className={buttonVariants()} href={topicNewHref()}>
          <PenSquareIcon aria-hidden="true" />
          {t("new_topic")}
        </HrefLink>
      }
      description={t("desc")}
      title={t("title")}
      wide
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section aria-labelledby="forum-feed" className="flex flex-col gap-4">
          <h2 className="sr-only" id="forum-feed">
            {t("feed.title")}
          </h2>

          <nav
            aria-label={t("tree")}
            className="flex gap-2 overflow-x-auto lg:hidden"
          >
            {tree.map(node => (
              <HrefLink
                className={buttonVariants({
                  className: "shrink-0",
                  size: "sm",
                  variant: "outline",
                })}
                href={forumHref(node.slug)}
                key={node.id}
              >
                <ForumIcon className="size-5" icon={node.metadata.icon} />
                {node.name}
              </HrefLink>
            ))}
          </nav>

          <FeedSortNav hrefFor={feedHref} search={search} />
          <TopicFeed forums={forumsById} search={search} topics={feed.topics} />
          <FeedPagination
            hasNextPage={feed.pageInfo.hasNextPage}
            hrefFor={feedHref}
            search={search}
          />
        </section>

        <aside
          aria-labelledby="forum-tree"
          className="bg-card hidden rounded-xl border p-2 lg:block"
        >
          <div className="flex flex-col gap-2">
            <h2
              className="text-foreground px-2 pt-2 text-sm font-semibold"
              id="forum-tree"
            >
              {t("tree")}
            </h2>
            <nav aria-labelledby="forum-tree">
              <SidebarForums nodes={tree} stats={stats} />
            </nav>
          </div>
        </aside>
      </div>
    </ForumShell>
  );
};

export default ForumsPage;
