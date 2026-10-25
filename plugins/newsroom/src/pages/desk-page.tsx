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

import type { DeskSearch } from "./desk-search";

import { cachedDeskId, queryDesk } from "./desk-queries";
import { deskHref, DESKS_HREF } from "./desk-search";
import { DeskColorDot, DeskTree } from "./desk-tree";
import { letterHref, letterNewHref } from "./letter-search";

const PAGE_SIZE = 20;

const zodLetterRow = z.object({
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string().nullable(),
  title: z.string(),
});

const fetchLetters = async (deskId: number, cursor?: string) => {
  const filters = {
    desk: String(deskId),
    includeDescendants: "true",
  };

  const list = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/letters",
    path: "/",
    args: {
      query: {
        ...filters,
        first: String(PAGE_SIZE),
        ...(cursor ? { cursor } : {}),
      },
    },
  });

  if (list.status !== 200) throw new Error("Loading the letters failed.");

  const { edges, pageInfo } = await list.json();

  return {
    letters: z.array(zodLetterRow).parse(edges),
    nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
  };
};

const loadDesk = async (
  queryClient: RouteLoadContext["queryClient"],
  idOrSlug: string,
  { cursor }: DeskSearch,
) => {
  // The list needs the desk's id. When the desks index already cached it,
  // both requests go out together instead of one after the other.
  const knownId = cachedDeskId(queryClient, idOrSlug);
  const [desk, early] = await Promise.all([
    queryDesk(queryClient, idOrSlug),
    // A stale id (the desk was moved or deleted since) is not this page's
    // error: the desk read below decides, and the list is fetched again.
    knownId === null ? null : fetchLetters(knownId, cursor).catch(() => null),
  ]);
  const { ancestors, children, container } = contentPageItem(desk);
  const page =
    early && knownId === container.id
      ? early
      : await fetchLetters(container.id, cursor);

  return {
    ancestors,
    children,
    container,
    ...page,
    isFirstPage: cursor === undefined,
  };
};

type DeskPageData = Awaited<ReturnType<typeof loadDesk>>;

const DeskNotFound = () => {
  const t = useTranslations("newsroom.desks.not_found");

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
            href={DESKS_HREF}
          >
            {t("back")}
          </HrefLink>
        </EmptyContent>
      </Empty>
    </div>
  );
};

const DesksCrumb = () => {
  const t = useTranslations("newsroom.desks");

  return <>{t("title")}</>;
};

export const route = defineRoute<DeskPageData, DeskSearch>({
  load: async ({ context, params, search }) =>
    await loadDesk(context.queryClient, params.slug, search),

  head: ({ loaderData }) => ({
    description: loaderData?.container.metadata.description ?? undefined,
    title: loaderData?.container.name,
  }),

  breadcrumb: {
    group: ({ loaderData }) => (
      <>
        <BreadcrumbItem>
          <BreadcrumbLink render={<HrefLink href={DESKS_HREF} />}>
            <DesksCrumb />
          </BreadcrumbLink>
        </BreadcrumbItem>
        {loaderData.ancestors.map(ancestor => (
          <Fragment key={ancestor.id}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink
                render={<HrefLink href={deskHref(ancestor.slug)} />}
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

  notFound: DeskNotFound,
});

const DeskPage = ({
  loaderData,
}: PluginRoutePageProps<DeskPageData, DeskSearch>) => {
  const t = useTranslations("newsroom.desks");
  const { children, container, letters, isFirstPage, nextCursor } = loaderData;

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-semibold tracking-tight text-balance">
            <DeskColorDot desk={container} />
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
          href={letterNewHref(container.id)}
        >
          {t("new_letter")}
        </HrefLink>
      </header>

      {children.length > 0 ? (
        <section
          aria-labelledby="desk-children"
          className="flex flex-col gap-4"
        >
          <h2
            className="text-foreground text-xl font-semibold text-balance"
            id="desk-children"
          >
            {t("children")}
          </h2>
          <DeskTree
            label={t("children")}
            nodes={children.map(child => ({ ...child, children: [] }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="desk-letters" className="flex flex-col gap-4">
        <h2
          className="text-foreground text-xl font-semibold text-balance"
          id="desk-letters"
        >
          {t("letters")}
        </h2>

        {letters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessagesSquareIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle render={<h3 />}>{t("empty_desk.title")}</EmptyTitle>
              <EmptyDescription>{t("empty_desk.desc")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={letterNewHref(container.id)}
              >
                {t("new_letter")}
              </HrefLink>
            </EmptyContent>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {letters.map(letter => (
              <li className="flex flex-col gap-1 p-4" key={letter.id}>
                {letter.slug === null ? (
                  <span className="text-foreground font-medium text-balance">
                    {letter.title}
                  </span>
                ) : (
                  <HrefLink
                    className="text-foreground font-medium text-balance hover:underline"
                    href={letterHref(letter.slug)}
                  >
                    {letter.title}
                  </HrefLink>
                )}
                {letter.publishedAt ? (
                  <time
                    className="text-muted-foreground text-sm leading-relaxed"
                    dateTime={new Date(letter.publishedAt).toISOString()}
                  >
                    <DateFormat date={letter.publishedAt} />
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
                href={deskHref(container.slug)}
              >
                {t("newest")}
              </HrefLink>
            )}
            {nextCursor === null ? null : (
              <HrefLink
                className={buttonVariants({ variant: "outline" })}
                href={deskHref(container.slug, { cursor: nextCursor })}
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

export default DeskPage;
