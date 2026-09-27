import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { ContentArticle } from "./content-article";

const zodLocalizedArticle = z.object({
  body: z.string(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadLocalizedArticle = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const detail = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/localized-articles",
    path: "/{slug}",
    args: {
      params: { slug: encodeURIComponent(slug) },
      query: { locale },
    },
  });

  return {
    item: contentPageItem(
      detail.status === 200
        ? zodLocalizedArticle.parse(await detail.json())
        : null,
    ),
    locale,
  };
};

type LocalizedArticlePageData = Awaited<
  ReturnType<typeof loadLocalizedArticle>
>;

export const route = definePluginRoute({
  load: async ({ context, params }) =>
    await loadLocalizedArticle({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData, params }) => ({
    alternates: loaderData
      ? {
          [loaderData.locale]: `/localized-articles/${encodeURIComponent(params.slug)}`,
        }
      : undefined,
    title: loaderData?.item.title,
  }),
});

const LocalizedArticlePage = ({
  loaderData: { item, locale },
}: PluginRoutePageProps<LocalizedArticlePageData>) => (
  <ContentArticle
    lang={locale}
    publishedAt={item.publishedAt}
    title={item.title}
  >
    <p className="text-foreground leading-relaxed text-pretty whitespace-pre-line">
      {item.body}
    </p>
  </ContentArticle>
);

export default LocalizedArticlePage;
