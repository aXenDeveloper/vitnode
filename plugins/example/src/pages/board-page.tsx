import { DateFormat } from "@vitnode/core/components/date-format";
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
import { MessagesSquareIcon, SearchXIcon } from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import type { BoardSearch } from "./board-search";

import { boardHref, BOARDS_HREF } from "./board-search";
import { BoardColorDot, BoardTree } from "./board-tree";
import { discussionHref, discussionNewHref } from "./discussion-search";

const PAGE_SIZE = 20;

const zodDiscussionRow = z.object({
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string().nullable(),
  title: z.string(),
});

const loadBoard = async (idOrSlug: string, { cursor }: BoardSearch) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/boards",
    path: "/{idOrSlug}",
    args: { params: { idOrSlug: encodeURIComponent(idOrSlug) } },
  });

  if (detail.status !== 200 && detail.status !== 404) {
    throw new Error("Loading the board failed.");
  }

  const { ancestors, children, container } = contentPageItem(
    detail.status === 200 ? await detail.json() : null,
  );

  const filters = {
    board: String(container.id),
    includeDescendants: "true",
  };

  const list = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/discussions",
    path: "/",
    args: {
      query: {
        ...filters,
        first: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      },
    },
  });

  if (list.status !== 200) throw new Error("Loading the discussions failed.");

  const { edges, pageInfo } = await list.json();

  return {
    ancestors,
    children,
    container,
    discussions: z.array(zodDiscussionRow).parse(edges),
    isFirstPage: cursor === undefined,
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
};

type BoardPageData = Awaited<ReturnType<typeof loadBoard>>;

const BoardNotFound = () => {
  const t = useTranslations("@vitnode/example.boards.not_found");

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
            href={BOARDS_HREF}
          >
            {t("back")}
          </a>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const BoardsCrumb = () => {
  const t = useTranslations("@vitnode/example.boards");

  return <>{t("title")}</>;
};

export const route = definePluginRoute<BoardPageData, BoardSearch>({
  load: async ({ params, search }) => await loadBoard(params.slug, search),

  head: ({ loaderData }) => ({
    description: loaderData?.container.metadata.description ?? undefined,
    title: loaderData?.container.name,
  }),

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink href={BOARDS_HREF}>
            <BoardsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.ancestors.map(ancestor => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={boardHref(ancestor.slug)}>
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

  notFound: BoardNotFound,
});

const BoardPage = ({
  loaderData,
}: PluginRoutePageProps<BoardPageData, BoardSearch>) => {
  const t = useTranslations("@vitnode/example.boards");
  const { children, container, discussions, isFirstPage, nextCursor } =
    loaderData;

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-semibold tracking-tight text-balance">
            <BoardColorDot board={container} />
            {container.name}
          </h1>
          {container.metadata.description ? (
            <p className="text-muted-foreground leading-relaxed text-pretty">
              {container.metadata.description}
            </p>
          ) : null}
        </div>

        <a
          className={buttonVariants({ className: "self-start" })}
          href={discussionNewHref(container.id)}
        >
          {t("new_discussion")}
        </a>
      </header>

      {children.length > 0 ? (
        <section
          aria-labelledby="board-children"
          className="flex flex-col gap-4"
        >
          <h2
            className="text-foreground text-xl font-semibold text-balance"
            id="board-children"
          >
            {t("children")}
          </h2>
          <BoardTree
            label={t("children")}
            nodes={children.map(child => ({ ...child, children: [] }))}
          />
        </section>
      ) : null}

      <section
        aria-labelledby="board-discussions"
        className="flex flex-col gap-4"
      >
        <h2
          className="text-foreground text-xl font-semibold text-balance"
          id="board-discussions"
        >
          {t("discussions")}
        </h2>

        {discussions.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle render={<h3 />}>{t("empty_board.title")}</EmptyTitle>
              <EmptyDescription>{t("empty_board.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <a
                className={buttonVariants({ variant: "outline" })}
                href={discussionNewHref(container.id)}
              >
                {t("new_discussion")}
              </a>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {discussions.map(discussion => (
              <li className="flex flex-col gap-1 p-4" key={discussion.id}>
                {discussion.slug === null ? (
                  <span className="text-foreground font-medium text-balance">
                    {discussion.title}
                  </span>
                ) : (
                  <a
                    className="text-foreground font-medium text-balance hover:underline"
                    href={discussionHref(discussion.slug)}
                  >
                    {discussion.title}
                  </a>
                )}
                {discussion.publishedAt ? (
                  <time
                    className="text-muted-foreground text-sm leading-relaxed"
                    dateTime={new Date(discussion.publishedAt).toISOString()}
                  >
                    <DateFormat date={discussion.publishedAt} />
                  </time>
                ) : null}
              </li>
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
                href={boardHref(container.slug)}
              >
                {t("newest")}
              </a>
            )}
            {nextCursor === null ? null : (
              <a
                className={buttonVariants({ variant: "outline" })}
                href={boardHref(container.slug, { cursor: nextCursor })}
              >
                {t("older")}
              </a>
            )}
          </nav>
        )}
      </section>
    </div>
  );
};

export default BoardPage;
