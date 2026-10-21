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
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { FolderTreeIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { BoardTree } from "./board-tree";
import { discussionsQueryOptions } from "./discussion-list";
import { discussionNewHref } from "./discussion-search";
import { boardsQueryOptions } from "./example-queries";
import { LatestDiscussions } from "./latest-discussions";

const loadBoards = async (
  queryClient: RouteLoadContext["queryClient"],
  locale: string,
) => {
  const [boards] = await Promise.all([
    queryClient.query(boardsQueryOptions()),
    // No `LOADER_DATA_QUERY_META`: the entry is dehydrated, so
    // `LatestDiscussions` finds it in the browser and renders on the server.
    queryClient
      .query(discussionsQueryOptions({ locale, search: {} }))
      .catch(() => null),
  ]);

  return { tree: contentContainerTree(boards) };
};

type BoardsPageData = Awaited<ReturnType<typeof loadBoards>>;

const BoardsBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.boards");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<BoardsPageData>({
  load: async ({ context }) =>
    await loadBoards(context.queryClient, context.locale),

  head: ({ t }) => ({
    description: t("@vitnode/example.boards.desc"),
    title: t("@vitnode/example.boards.title"),
  }),

  breadcrumb: BoardsBreadcrumb,
});

const BoardsPage = ({ loaderData }: PluginRoutePageProps<BoardsPageData>) => {
  const t = useTranslations("@vitnode/example.boards");

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {t("desc")}
          </p>
        </div>

        <HrefLink
          className={buttonVariants({ className: "self-start" })}
          href={discussionNewHref()}
        >
          {t("new_discussion")}
        </HrefLink>
      </header>

      {loaderData.tree.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon aria-hidden="true" />
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
        <BoardTree label={t("tree")} nodes={loaderData.tree} />
      )}

      <LatestDiscussions />
    </div>
  );
};

export default BoardsPage;
