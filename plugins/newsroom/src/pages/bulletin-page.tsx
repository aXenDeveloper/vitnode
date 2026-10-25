import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { ContentStory } from "./content-story";

const zodBulletin = z.object({
  body: z.string(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadBulletin = async ({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) => {
  const detail = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/bulletins",
    path: "/{slug}",
    args: {
      params: { slug: encodeURIComponent(slug) },
      query: { locale },
    },
  });

  return {
    item: contentPageItem(
      detail.status === 200 ? zodBulletin.parse(await detail.json()) : null,
    ),
    locale,
  };
};

type BulletinPageData = Awaited<ReturnType<typeof loadBulletin>>;

export const route = definePluginRoute({
  load: async ({ context, params }) =>
    await loadBulletin({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData, params }) => ({
    alternates: loaderData
      ? {
          [loaderData.locale]: `/bulletins/${encodeURIComponent(params.slug)}`,
        }
      : undefined,
    title: loaderData?.item.title,
  }),
});

const BulletinPage = ({
  loaderData: { item, locale },
}: PluginRoutePageProps<BulletinPageData>) => (
  <ContentStory lang={locale} publishedAt={item.publishedAt} title={item.title}>
    <p className="text-foreground leading-relaxed text-pretty whitespace-pre-line">
      {item.body}
    </p>
  </ContentStory>
);

export default BulletinPage;
