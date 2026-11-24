import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

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
  ContentAccessRequired,
  contentPageItem,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { PenSquareIcon, SearchXIcon } from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "use-intl";

import type { ForumSearch } from "./forum-links";
import type { FeedHref } from "./topic-feed";

import { indexBy } from "./forum-data";
import { FORUM_HREF, forumHref, topicNewHref } from "./forum-links";
import { ForumList } from "./forum-list";
import {
  feedQueryOptions,
  forumStatsQueryOptions,
  queryForum,
} from "./forum-queries";
import { ForumIcon, ForumShell } from "./forum-ui";
import { FeedPagination, FeedSortNav, TopicFeed } from "./topic-feed";

const loadForum = async (
  queryClient: QueryClient,
  { locale, slug }: { locale: string; slug: string },
  search: ForumSearch,
) => {
  const { ancestors, children, container } = contentPageItem(
    await queryForum(queryClient, slug, locale),
  );

  // A forum the viewer may see but not read lists nothing - not even how
  // many topics it holds.
  const canRead = container.access.canRead;
  const [feed, forumStats] = await Promise.all([
    canRead
      ? queryClient.query(
          feedQueryOptions({ ...search, forumId: container.id }),
        )
      : Promise.resolve(null),
    children.length > 0
      ? queryClient.query(forumStatsQueryOptions())
      : Promise.resolve([]),
  ]);

  return {
    ancestors,
    canRead,
    children,
    container,
    feed,
    forumStats,
    search,
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
    await loadForum(
      context.queryClient,
      { locale: context.locale, slug: params.slug },
      search,
    ),

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

const ForumPage = ({
  loaderData,
}: PluginRoutePageProps<ForumPageData, ForumSearch>) => {
  const t = useTranslations("@vitnode/forum.forums");
  const { canRead, children, container, feed, forumStats, search } = loaderData;
  const hrefFor: FeedHref = next => forumHref(container.slug, next);

  return (
    <ForumShell
      actions={
        canRead ? (
          <HrefLink
            className={buttonVariants()}
            href={topicNewHref(container.id)}
          >
            <PenSquareIcon aria-hidden="true" />
            {t("new_topic")}
          </HrefLink>
        ) : null
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

        {!canRead || !feed ? (
          <ContentAccessRequired headingLevel="h3" />
        ) : (
          <>
            <FeedSortNav hrefFor={hrefFor} search={search} />
            <TopicFeed
              forumId={container.id}
              search={search}
              topics={feed.topics}
            />
            <FeedPagination
              hasNextPage={feed.pageInfo.hasNextPage}
              hrefFor={hrefFor}
              search={search}
            />
          </>
        )}
      </section>
    </ForumShell>
  );
};

export default ForumPage;
