import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useQueryClient } from "@tanstack/react-query";
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
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { FolderTreeIcon } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import type { TopicNewSearch } from "./forum-links";

import { useForumRejection } from "./forum-errors";
import { FORUM_HREF, topicEditHref, topicHref } from "./forum-links";
import { forumsQueryOptions, invalidateForumTopics } from "./forum-queries";
import { ForumShell } from "./forum-ui";
import {
  TOPIC_FORM_FIELDS,
  TopicCreateForm,
  type TopicCreateFormSchema,
} from "./topic-form";

const loadForumOptions = async (queryClient: QueryClient) =>
  (await queryClient.query(forumsQueryOptions())).map(forum => ({
    label: `${"— ".repeat(forum.depth - 1)}${forum.name}`,
    value: String(forum.id),
  }));

type TopicNewData = Awaited<ReturnType<typeof loadForumOptions>>;

const TopicNewBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.topics.new");

  return <span>{t("title")}</span>;
};

export const route = defineRoute<TopicNewData, TopicNewSearch>({
  load: async ({ context }) => await loadForumOptions(context.queryClient),

  head: ({ t }) => ({
    description: t("@vitnode/forum.topics.new.desc"),
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.topics.new.title"),
  }),

  breadcrumb: TopicNewBreadcrumb,
});

const TopicNewPage = ({
  loaderData: options,
  search,
}: PluginRoutePageProps<TopicNewData, TopicNewSearch>) => {
  const t = useTranslations("@vitnode/forum.topics");
  const tErrors = useTranslations("@vitnode/forum.forums.errors");
  const rejectTopic = useForumRejection(TOPIC_FORM_FIELDS);
  const [isLeaving, setIsLeaving] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useHrefNavigate();

  const onSubmit: AutoFormOnSubmit<TopicCreateFormSchema> = async (
    { forum, ...values },
    form,
  ) => {
    const res = await fetcher({
      plugin: manifest.id,
      method: "post",
      module: "content/topics",
      path: "/",
      args: { body: { values: { ...values, forum: Number(forum) } } },
    });

    if (res.status === 201) {
      const record = await res.json();
      setIsLeaving(true);
      await invalidateForumTopics(queryClient);
      await navigate(
        record.approval?.status === "pending" || record.slug === null
          ? topicEditHref(record.id, { submitted: true })
          : topicHref(record.slug, { created: true }),
      );

      return;
    }

    if (res.status === 409) {
      setFormFieldError(form, "title", tErrors("unique"));

      return;
    }

    await rejectTopic(res, form);
  };

  return (
    <ForumShell description={t("new.desc")} title={t("new.title")}>
      {options.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderTreeIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle render={<h2 />}>{t("new.no_forums.title")}</EmptyTitle>
            <EmptyDescription>{t("new.no_forums.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <HrefLink
              className={buttonVariants({ variant: "outline" })}
              href={FORUM_HREF}
            >
              {t("new.no_forums.action")}
            </HrefLink>
          </EmptyContent>
        </Empty>
      ) : (
        <TopicCreateForm
          forums={{
            options,
            selected:
              search.forum === undefined ? undefined : String(search.forum),
          }}
          isLeaving={isLeaving}
          onSubmit={onSubmit}
          submitLabel={t("new.submit")}
        />
      )}
    </ForumShell>
  );
};

export default TopicNewPage;
