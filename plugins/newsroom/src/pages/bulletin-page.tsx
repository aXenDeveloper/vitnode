import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { ContentStory } from "./content-story";

const zodBulletin = z.object({
  body: z.string(),
  id: z.number(),
  locale: z.string(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadBulletin = async (locale: string, slug: string) => {
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

  const item = contentPageItem(
    detail.status === 200 ? zodBulletin.parse(await detail.json()) : null,
  );

  return { item, locale };
};

type BulletinPageData = Awaited<ReturnType<typeof loadBulletin>>;

export const route = defineRoute<BulletinPageData>({
  load: async ({ context, params }) =>
    await loadBulletin(context.locale, params.slug),

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
  loaderData: { item },
}: PluginRoutePageProps<BulletinPageData>) => (
  <ContentStory
    lang={item.locale}
    publishedAt={item.publishedAt}
    title={item.title}
  >
    <p className="text-foreground leading-relaxed text-pretty whitespace-pre-line">
      {item.body}
    </p>
  </ContentStory>
);

export default BulletinPage;
