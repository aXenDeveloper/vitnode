import {
  type AutoFormOnSubmit,
  setFormFieldError,
} from "@vitnode/core/components/form/auto-form";
import { definePluginRoute } from "@vitnode/core/routing";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useState } from "react";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

import {
  DiscussionForm,
  type DiscussionFormSchema,
  useDiscussionRejection,
} from "./discussion-form";
import { discussionEditHref, discussionHref } from "./discussion-search";
import { DiscussionShell } from "./discussion-shell";

const DiscussionNewBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.discussions.new");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  head: ({ t }) => ({
    description: t("@vitnode/example.discussions.new.desc"),
    robots: "noindex, nofollow",
    title: t("@vitnode/example.discussions.new.title"),
  }),

  breadcrumb: DiscussionNewBreadcrumb,
});

const DiscussionNewPage = () => {
  const t = useTranslations("@vitnode/example.discussions");
  const rejectDiscussion = useDiscussionRejection();
  const [isLeaving, setIsLeaving] = useState(false);

  const onSubmit: AutoFormOnSubmit<DiscussionFormSchema> = async (
    values,
    form,
  ) => {
    const res = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "post",
      module: "content/discussions",
      path: "/",
      args: { body: { values } },
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

    await rejectDiscussion(res, form);
  };

  return (
    <DiscussionShell description={t("new.desc")} title={t("new.title")}>
      <DiscussionForm
        isLeaving={isLeaving}
        onSubmit={onSubmit}
        submitLabel={t("new.submit")}
      />
    </DiscussionShell>
  );
};

export default DiscussionNewPage;
