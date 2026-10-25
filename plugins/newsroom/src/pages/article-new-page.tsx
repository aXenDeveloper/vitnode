import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";

import { useQueryClient } from "@tanstack/react-query";
import { emptyRichTextDocument } from "@vitnode/core/content";
import { definePluginRoute } from "@vitnode/core/routing";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useHrefNavigate } from "@vitnode/core/tanstack/link";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import {
  ARTICLE_FORM_FIELDS,
  ArticleForm,
  type ArticleFormSchema,
} from "./article-form";

export const route = definePluginRoute({
  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("newsroom.articles.new.title"),
  }),
});

const ArticleNewPage = () => {
  const t = useTranslations("newsroom.articles.new");
  const navigate = useHrefNavigate();
  const queryClient = useQueryClient();
  const write = useContentPublicWrite({
    fields: ARTICLE_FORM_FIELDS,
    uniqueField: "title",
  });

  const onSubmit: AutoFormOnSubmit<ArticleFormSchema> = async (
    values,
    form,
  ) => {
    const record = await write.submit(
      form,
      async () =>
        await fetcher({
          plugin: manifest.id,
          method: "post",
          module: "content/news",
          path: "/",
          args: { body: { values } },
        }),
    );
    if (!record) return;

    await queryClient.invalidateQueries({
      queryKey: [manifest.id, "articles"],
    });

    // Waits for a moderator. Its public page answers 404 until approval.
    if (record.approval?.status === "pending") {
      toast.info(t("pending.title"), { description: t("pending.desc") });
      await navigate(`/news/${record.id}/edit`);

      return;
    }

    // A draft nobody has to review. It stays private, so open its edit page.
    if (record.status !== "published") {
      toast.info(t("draft.title"), { description: t("draft.desc") });
      await navigate(`/news/${record.id}/edit`);

      return;
    }

    toast.success(t("success.title"), { description: t("success.desc") });
    await navigate(`/news/${record.slug}`);
  };

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {t("title")}
      </h1>
      <ArticleForm
        defaultValues={{ body: emptyRichTextDocument(), title: "" }}
        onSubmit={onSubmit}
        submitLabel={t("submit")}
      />
    </div>
  );
};

export default ArticleNewPage;
