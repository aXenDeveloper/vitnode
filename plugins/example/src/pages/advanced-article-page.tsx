import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import {
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { CONFIG_PLUGIN } from "@/const";

import { ContentArticle } from "./content-article";

const zodAdvancedArticle = z.object({
  faq: z
    .array(z.object({ answer: z.string(), question: z.string() }))
    .nullable()
    .optional(),
  publishedAt: z.string().nullable(),
  seo: z
    .object({ description: z.string().nullable().optional() })
    .nullable()
    .optional(),
  title: z.string(),
});

const loadAdvancedArticle = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/advanced-articles",
      path: "/delivery/resolve/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/advanced-articles",
      path: "/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the advanced article "${slug}" answered ${resolution.status}.`,
    );
  }

  return contentDeliveryPage({
    item:
      detail.status === 200
        ? zodAdvancedArticle.parse(await detail.json())
        : null,
    resolution: await resolution.json(),
  });
};

type AdvancedArticlePageData = Awaited<ReturnType<typeof loadAdvancedArticle>>;

export const route = definePluginRoute({
  load: async ({ context, params }) =>
    await loadAdvancedArticle({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

const AdvancedArticlePage = ({
  loaderData: { item, metadata },
}: PluginRoutePageProps<AdvancedArticlePageData>) => {
  const t = useTranslations("@vitnode/example.articles");
  const faq = item.faq ?? [];

  return (
    <ContentArticle
      lang={metadata.locale ?? undefined}
      lead={item.seo?.description}
      publishedAt={item.publishedAt}
      title={item.title}
    >
      {faq.length > 0 ? (
        <section
          aria-labelledby="advanced-article-faq"
          className="flex flex-col gap-4"
        >
          <h2
            className="text-foreground text-xl font-semibold tracking-tight text-balance"
            id="advanced-article-faq"
          >
            {t("faq")}
          </h2>

          <dl className="flex flex-col gap-4">
            {faq.map(entry => (
              <div className="flex flex-col gap-1" key={entry.question}>
                <dt className="text-foreground font-medium text-pretty">
                  {entry.question}
                </dt>
                <dd className="text-muted-foreground leading-relaxed text-pretty">
                  {entry.answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </ContentArticle>
  );
};

export default AdvancedArticlePage;
