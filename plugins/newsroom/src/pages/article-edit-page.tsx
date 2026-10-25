import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";

import { useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import {
  ARTICLE_FORM_FIELDS,
  ArticleForm,
  type ArticleFormSchema,
} from "./article-form";

// Answers only for the author and moderators, drafts included.
const fetchEditableArticle = async (id: number) =>
  await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/news",
    path: "/{id}/edit",
    args: { params: { id } },
  });

const loadEditableArticle = async (param: string) => {
  const id = Number(param);
  if (!Number.isSafeInteger(id) || id < 1)
    return { state: "notFound" as const };

  const res = await fetchEditableArticle(id);
  if (res.status === 200) {
    return { record: await res.json(), state: "ready" as const };
  }
  if (res.status === 401) return { id, state: "unauthenticated" as const };
  if (res.status === 403) return { state: "forbidden" as const };
  if (res.status === 404) return { state: "notFound" as const };

  // A server failure is not "not found": let the app's error page show it.
  throw new Error(`Loading article ${id} for editing failed.`);
};

type ArticleEditData = Awaited<ReturnType<typeof loadEditableArticle>>;

type EditableArticle = Extract<ArticleEditData, { state: "ready" }>["record"];

export const route = definePluginRoute({
  load: async ({ params }) => await loadEditableArticle(params.id),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("newsroom.articles.edit.title"),
  }),
});

const ArticleEditForm = ({ record }: { record: EditableArticle }) => {
  const t = useTranslations("newsroom.articles.edit");
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState({
    slug: record.slug,
    status: record.status,
  });
  // AutoForm resets an untouched form to the defaults it renders with, so the
  // defaults follow every save.
  const [defaults, setDefaults] = useState({
    body: record.values.body,
    title: record.values.title,
  });
  const write = useContentPublicWrite({
    fields: ARTICLE_FORM_FIELDS,
    latestVersion: async () => {
      const res = await fetchEditableArticle(record.id);

      return res.status === 200 ? (await res.json()).version : null;
    },
    uniqueField: "title",
    version: record.version,
  });

  const onSubmit: AutoFormOnSubmit<ArticleFormSchema> = async (
    values,
    form,
  ) => {
    const updated = await write.submit(
      form,
      async expectedVersion =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/news",
          path: "/{id}",
          args: {
            params: { id: record.id },
            body: { values, expectedVersion },
          },
        }),
    );
    if (!updated) return;

    setCurrent({ slug: updated.slug, status: updated.status });
    setDefaults(values);
    form.reset(values);
    await queryClient.invalidateQueries({
      queryKey: [manifest.id, "articles"],
    });

    toast.success(t("success.title"), {
      description: t("success.desc", { title: values.title }),
    });
  };

  return (
    <>
      {write.conflict}
      <ArticleForm
        defaultValues={defaults}
        onSubmit={onSubmit}
        submitLabel={t("submit")}
      />
      {current.status === "published" && current.slug !== null ? (
        <HrefLink
          className={buttonVariants({
            className: "self-start",
            variant: "link",
          })}
          href={`/news/${current.slug}`}
        >
          {t("view")}
        </HrefLink>
      ) : null}
    </>
  );
};

const ArticleEditPage = ({
  loaderData,
  params,
}: PluginRoutePageProps<ArticleEditData>) => {
  const t = useTranslations("newsroom.articles");

  if (loaderData.state === "unauthenticated") {
    return (
      <div className="container mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold text-balance">
          {t("state.unauthenticated.title")}
        </h1>
        <HrefLink
          className={buttonVariants({ className: "self-start" })}
          href={`/login?returnTo=${encodeURIComponent(`/news/${loaderData.id}/edit`)}`}
        >
          {t("state.unauthenticated.action")}
        </HrefLink>
      </div>
    );
  }

  if (loaderData.state !== "ready") {
    const key = loaderData.state === "forbidden" ? "forbidden" : "not_found";

    return (
      <div className="container mx-auto flex max-w-3xl flex-col gap-2 px-4 py-8">
        <h1 className="text-2xl font-semibold text-balance">
          {t(`state.${key}.title`)}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {t(`state.${key}.desc`)}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {t("edit.title")}
      </h1>
      <ArticleEditForm key={params.id} record={loaderData.record} />
    </div>
  );
};

export default ArticleEditPage;
