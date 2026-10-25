import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink, useHrefNavigate } from "@vitnode/core/tanstack/link";
import {
  defineRoute,
  type RouteLoadContext,
} from "@vitnode/core/tanstack/plugin-routes";
import { FolderTreeIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import type { LetterNewSearch } from "./letter-search";

import { desksQueryOptions } from "./desk-queries";
import { DESKS_HREF } from "./desk-search";
import {
  LETTER_FIELDS,
  LetterCreateForm,
  type LetterCreateFormSchema,
} from "./letter-form";
import { invalidateLetterLists } from "./letter-list";
import { letterEditHref, letterHref } from "./letter-search";
import { LetterShell } from "./letter-shell";

const loadDeskOptions = async (queryClient: RouteLoadContext["queryClient"]) =>
  (await queryClient.query(desksQueryOptions())).map(desk => ({
    label: `${"— ".repeat(desk.depth - 1)}${desk.name}`,
    value: String(desk.id),
  }));

type LetterNewData = Awaited<ReturnType<typeof loadDeskOptions>>;

const LetterNewBreadcrumb = () => {
  const t = useTranslations("newsroom.letters.new");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<LetterNewData, LetterNewSearch>({
  load: async ({ context }) => await loadDeskOptions(context.queryClient),

  head: ({ t }) => ({
    description: t("newsroom.letters.new.desc"),
    robots: "noindex, nofollow",
    title: t("newsroom.letters.new.title"),
  }),

  breadcrumb: LetterNewBreadcrumb,
});

const LetterNewPage = ({
  loaderData: options,
  search,
}: PluginRoutePageProps<LetterNewData, LetterNewSearch>) => {
  const t = useTranslations("newsroom.letters");
  const write = useContentPublicWrite({
    fields: LETTER_FIELDS,
    uniqueField: "title",
  });
  const [isLeaving, setIsLeaving] = useState(false);
  const navigate = useHrefNavigate();
  const queryClient = useQueryClient();

  const onSubmit: AutoFormOnSubmit<LetterCreateFormSchema> = async (
    { desk, ...values },
    form,
  ) => {
    const record = await write.submit(
      form,
      async () =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/letters",
          path: "/",
          args: { body: { values: { ...values, desk: Number(desk) } } },
        }),
    );
    if (!record) return;

    setIsLeaving(true);
    await invalidateLetterLists(queryClient);
    await navigate(
      record.slug === null
        ? letterEditHref(record.id)
        : letterHref(record.slug, { created: true }),
    );
  };

  return (
    <LetterShell description={t("new.desc")} title={t("new.title")}>
      {options.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h2 />}>{t("new.no_desks.title")}</EmptyTitle>
            <EmptyDescription>{t("new.no_desks.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={DESKS_HREF}
            >
              {t("new.no_desks.action")}
            </HrefLink>
          </EmptyContent>
        </Empty>
      ) : (
        <LetterCreateForm
          desks={{
            options,
            selected:
              search.desk === undefined ? undefined : String(search.desk),
          }}
          isLeaving={isLeaving}
          onSubmit={onSubmit}
          submitLabel={t("new.submit")}
        />
      )}
    </LetterShell>
  );
};

export default LetterNewPage;
