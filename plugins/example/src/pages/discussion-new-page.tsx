import type { PluginRoutePageProps } from "@vitnode/core/routing";

import {
  type AutoFormOnSubmit,
  setFormFieldError,
} from "@vitnode/core/components/form/auto-form";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
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

import type { DiscussionNewSearch } from "./discussion-search";

import { BOARDS_HREF } from "./board-search";
import {
  DiscussionCreateForm,
  type DiscussionCreateFormSchema,
  useDiscussionRejection,
} from "./discussion-form";
import { discussionEditHref, discussionHref } from "./discussion-search";
import { DiscussionShell } from "./discussion-shell";
import { boardsQueryOptions } from "./example-queries";

const loadBoardOptions = async (queryClient: RouteLoadContext["queryClient"]) =>
  (await queryClient.query(boardsQueryOptions())).map(board => ({
    label: `${"— ".repeat(board.depth - 1)}${board.name}`,
    value: String(board.id),
  }));

type DiscussionNewData = Awaited<ReturnType<typeof loadBoardOptions>>;

const DiscussionNewBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.discussions.new");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<DiscussionNewData, DiscussionNewSearch>({
  load: async ({ context }) => await loadBoardOptions(context.queryClient),

  head: ({ t }) => ({
    description: t("@vitnode/example.discussions.new.desc"),
    robots: "noindex, nofollow",
    title: t("@vitnode/example.discussions.new.title"),
  }),

  breadcrumb: DiscussionNewBreadcrumb,
});

const DiscussionNewPage = ({
  loaderData: options,
  search,
}: PluginRoutePageProps<DiscussionNewData, DiscussionNewSearch>) => {
  const t = useTranslations("@vitnode/example.discussions");
  const rejectDiscussion = useDiscussionRejection();
  const [isLeaving, setIsLeaving] = useState(false);
  const navigate = useHrefNavigate();

  const onSubmit: AutoFormOnSubmit<DiscussionCreateFormSchema> = async (
    { board, ...values },
    form,
  ) => {
    const res = await fetcher({
      plugin: manifest.id,
      method: "post",
      module: "content/discussions",
      path: "/",
      args: { body: { values: { ...values, board: Number(board) } } },
    });

    if (res.status === 201) {
      const record = await res.json();
      setIsLeaving(true);
      await navigate(
        record.slug === null
          ? discussionEditHref(record.id)
          : discussionHref(record.slug, { created: true }),
      );

      return;
    }

    if (res.status === 409) {
      setFormFieldError(form, "title", t("errors.unique"));

      return;
    }

    await rejectDiscussion(res, form);
  };

  return (
    <DiscussionShell description={t("new.desc")} title={t("new.title")}>
      {options.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h2 />}>{t("new.no_boards.title")}</EmptyTitle>
            <EmptyDescription>{t("new.no_boards.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={BOARDS_HREF}
            >
              {t("new.no_boards.action")}
            </HrefLink>
          </EmptyContent>
        </Empty>
      ) : (
        <DiscussionCreateForm
          boards={{
            options,
            selected:
              search.board === undefined ? undefined : String(search.board),
          }}
          isLeaving={isLeaving}
          onSubmit={onSubmit}
          submitLabel={t("new.submit")}
        />
      )}
    </DiscussionShell>
  );
};

export default DiscussionNewPage;
