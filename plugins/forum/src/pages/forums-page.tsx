import type { QueryClient } from "@tanstack/react-query";
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
import { MessagesSquareIcon, PenSquareIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { indexBy } from "./forum-data";
import { topicNewHref } from "./forum-links";
import { ForumList } from "./forum-list";
import { forumsQueryOptions, forumStatsQueryOptions } from "./forum-queries";
import { ForumShell } from "./forum-ui";

const loadForums = async (queryClient: QueryClient) => {
  const [forums, stats] = await Promise.all([
    queryClient.query(forumsQueryOptions()),
    queryClient.query(forumStatsQueryOptions()),
  ]);

  return { stats, tree: contentContainerTree(forums) };
};

type ForumsPageData = Awaited<ReturnType<typeof loadForums>>;

const ForumsBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.forums");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<ForumsPageData>({
  load: async ({ context }) => await loadForums(context.queryClient),

  head: ({ t }) => ({
    description: t("@vitnode/forum.forums.desc"),
    title: t("@vitnode/forum.forums.title"),
  }),

  breadcrumb: ForumsBreadcrumb,
});

const ForumsPage = ({ loaderData }: PluginRoutePageProps<ForumsPageData>) => {
  const t = useTranslations("@vitnode/forum.forums");
  const stats = indexBy(loaderData.stats, item => item.forumId);

  return (
    <ForumShell
      actions={
        loaderData.tree.length > 0 ? (
          <HrefLink className={buttonVariants()} href={topicNewHref()}>
            <PenSquareIcon aria-hidden="true" />
            {t("new_topic")}
          </HrefLink>
        ) : null
      }
      description={t("desc")}
      title={t("title")}
    >
      {loaderData.tree.length === 0 ? (
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
      ) : (
        <section aria-labelledby="forum-tree" className="flex flex-col gap-4">
          <h2 className="sr-only" id="forum-tree">
            {t("tree")}
          </h2>
          <ForumList label={t("tree")} nodes={loaderData.tree} stats={stats} />
        </section>
      )}
    </ForumShell>
  );
};

export default ForumsPage;
