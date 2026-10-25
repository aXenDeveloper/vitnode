import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import {
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { ContentStory } from "./content-story";

const zodStory = z.object({
  excerpt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadStory = async (slug: string) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/stories",
      path: "/delivery/resolve/{slug}",
      args: { params: { slug: encodeURIComponent(slug) } },
    }),
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/stories",
      path: "/{slug}",
      args: { params: { slug: encodeURIComponent(slug) } },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the article "${slug}" answered ${resolution.status}.`,
    );
  }

  return contentDeliveryPage({
    item: detail.status === 200 ? zodStory.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  });
};

type StoryPageData = Awaited<ReturnType<typeof loadStory>>;

export const route = definePluginRoute({
  load: async ({ params }) => await loadStory(params.slug),

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

const StoryPage = ({
  loaderData: { item },
}: PluginRoutePageProps<StoryPageData>) => (
  <ContentStory
    lead={item.excerpt}
    publishedAt={item.publishedAt}
    title={item.title}
  />
);

export default StoryPage;
