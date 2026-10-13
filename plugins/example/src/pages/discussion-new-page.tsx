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
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { FolderTreeIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

import type { DiscussionNewSearch } from "./discussion-search";

import { BOARDS_HREF } from "./board-search";
import { fetchBoards } from "./boards-data";
import {
  DiscussionCreateForm,
  type DiscussionCreateFormSchema,
  useDiscussionRejection,
} from "./discussion-form";
import { discussionEditHref, discussionHref } from "./discussion-search";
import { DiscussionShell } from "./discussion-shell";

/** Every board in tree order, indented by depth so the select reads like the tree. */
const loadBoardOptions = async () =>
  (await fetchBoards()).map(board => ({
    label: `${"— ".repeat(board.depth - 1)}${board.name}`,
    value: String(board.id),
  }));

type DiscussionNewData = Awaited<ReturnType<typeof loadBoardOptions>>;

const DiscussionNewBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.discussions.new");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute<DiscussionNewData, DiscussionNewSearch>({
  load: loadBoardOptions,

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

  const onSubmit: AutoFormOnSubmit<DiscussionCreateFormSchema> = async (
    { board, ...values },
    form,
  ) => {
    const res = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "content/discussions",
      path: "/",
      args: { body: { values: { ...values, board: Number(board) } } },
    });

    if (res.status === 201) {
      const record = await res.json();
      setIsLeaving(true);

      window.location.assign(
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

    // A board deleted while the form was open comes back as a 400 issue on
    // `board`, which lands under the select.
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
            <a
              className={buttonVariants({ variant: "outline" })}
              href={BOARDS_HREF}
            >
              {t("new.no_boards.action")}
            </a>
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
