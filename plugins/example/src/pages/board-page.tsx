import type { PluginRoutePageProps } from "@vitnode/core/routing";

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
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { MessagesSquareIcon, SearchXIcon } from "lucide-react";
import { Fragment } from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import type { BoardSearch } from "./board-search";

import { boardHref, BOARDS_HREF } from "./board-search";
import { BoardColorDot, BoardTree } from "./board-tree";
import { discussionHref, discussionNewHref } from "./discussion-search";
import { cachedBoardId, queryBoard } from "./example-queries";

const PAGE_SIZE = 20;

const zodDiscussionRow = z.object({
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string().nullable(),
  title: z.string(),
});

const fetchDiscussions = async (boardId: number, cursor?: string) => {
  const filters = {
    board: String(boardId),
    includeDescendants: "true",
  };

  const list = await fetcher({
    plugin: manifest.id,
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
    discussions: z.array(zodDiscussionRow).parse(edges),
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
};

const loadBoard = async (
  queryClient: RouteLoadContext["queryClient"],
  idOrSlug: string,
  { cursor }: BoardSearch,
) => {
  // The list needs the board's id. When the boards index already cached it,
  // both requests go out together instead of one after the other.
  const knownId = cachedBoardId(queryClient, idOrSlug);
  const [board, early] = await Promise.all([
    queryBoard(queryClient, idOrSlug),
    // A stale id (the board was moved or deleted since) is not this page's
    // error: the board read below decides, and the list is fetched again.
    knownId === null
      ? null
      : fetchDiscussions(knownId, cursor).catch(() => null),
  ]);
  const { ancestors, children, container } = contentPageItem(board);
  const page =
    early && knownId === container.id
      ? early
      : await fetchDiscussions(container.id, cursor);

  return {
    ancestors,
    children,
    container,
    ...page,
    isFirstPage: cursor === undefined,
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
          <HrefLink
            className={buttonVariants({ variant: "outline" })}
            href={BOARDS_HREF}
          >
            {t("back")}
          </HrefLink>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const BoardsCrumb = () => {
  const t = useTranslations("@vitnode/example.boards");

  return <>{t("title")}</>;
};

export const route = defineRoute<BoardPageData, BoardSearch>({
  load: async ({ context, params, search }) =>
    await loadBoard(context.queryClient, params.slug, search),

  head: ({ loaderData }) => ({
    description: loaderData?.container.metadata.description ?? undefined,
    title: loaderData?.container.name,
  }),

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink render={<HrefLink href={BOARDS_HREF} />}>
            <BoardsCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.ancestors.map(ancestor => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<HrefLink href={boardHref(ancestor.slug)} />}
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

        <HrefLink
          className={buttonVariants({ className: "self-start" })}
          href={discussionNewHref(container.id)}
        >
          {t("new_discussion")}
        </HrefLink>
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
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={discussionNewHref(container.id)}
              >
                {t("new_discussion")}
              </HrefLink>
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
                  <HrefLink
                    className="text-foreground font-medium text-balance hover:underline"
                    href={discussionHref(discussion.slug)}
                  >
                    {discussion.title}
                  </HrefLink>
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
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={boardHref(container.slug)}
              >
                {t("newest")}
              </HrefLink>
            )}
            {nextCursor === null ? null : (
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={boardHref(container.slug, { cursor: nextCursor })}
              >
                {t("older")}
              </HrefLink>
            )}
          </nav>
        )}
      </section>
    </div>
  );
};

export default BoardPage;
