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

import { desksQueryOptions } from "./desk-queries";
import { DeskTree } from "./desk-tree";
import { LatestLetters } from "./latest-letters";
import { lettersQueryOptions } from "./letter-list";
import { letterNewHref } from "./letter-search";

const loadDesks = async (
  queryClient: RouteLoadContext["queryClient"],
  locale: string,
) => {
  const [desks] = await Promise.all([
    queryClient.query(desksQueryOptions()),
    // No `LOADER_DATA_QUERY_META`: the entry is dehydrated, so
    // `LatestLetters` finds it in the browser and renders on the server.
    queryClient
      .query(lettersQueryOptions({ locale, search: {} }))
      .catch(() => null),
  ]);

  return { tree: contentContainerTree(desks) };
};

type DesksPageData = Awaited<ReturnType<typeof loadDesks>>;

const DesksBreadcrumb = () => {
  const t = useTranslations("newsroom.desks");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<DesksPageData>({
  load: async ({ context }) =>
    await loadDesks(context.queryClient, context.locale),

  head: ({ t }) => ({
    description: t("newsroom.desks.desc"),
    title: t("newsroom.desks.title"),
  }),

  breadcrumb: DesksBreadcrumb,
});

const DesksPage = ({ loaderData }: PluginRoutePageProps<DesksPageData>) => {
  const t = useTranslations("newsroom.desks");

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
          href={letterNewHref()}
        >
          {t("new_letter")}
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
        <DeskTree label={t("tree")} nodes={loaderData.tree} />
      )}

      <LatestLetters />
    </div>
  );
};

export default DesksPage;
