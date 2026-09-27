import { DateFormat } from "@vitnode/core/components/date-format";
import { EditorContent } from "@vitnode/core/components/ui/editor-content";
import { zodContentFileDescriptor } from "@vitnode/core/content";
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

const zodBlogPost = z.object({
  content: z.string(),
  coverImage: zodContentFileDescriptor.nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  title: z.string(),
});

const loadBlogPost = async ({
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
      module: "content/blog",
      path: "/delivery/resolve/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
    fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "get",
      module: "content/blog",
      path: "/{slug}",
      args: {
        params: { slug: encodeURIComponent(slug) },
        query: { locale },
      },
    }),
  ]);

  if (resolution.status !== 200) {
    throw new Error(
      `Resolving the blog article "${slug}" answered ${resolution.status}.`,
    );
  }

  return contentDeliveryPage({
    item: detail.status === 200 ? zodBlogPost.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  });
};

type BlogPostPageData = Awaited<ReturnType<typeof loadBlogPost>>;

export const route = definePluginRoute({
  load: async ({ context, params }) =>
    await loadBlogPost({ locale: context.locale, slug: params.slug }),

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

const BlogPostPage = ({
  loaderData: { item, metadata },
}: PluginRoutePageProps<BlogPostPageData>) => {
  const t = useTranslations("@vitnode/blog.post");

  return (
    <article
      className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12"
      lang={metadata.locale ?? undefined}
    >
      <header className="flex flex-col gap-3">
        {item.publishedAt ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("published")}{" "}
            <time dateTime={new Date(item.publishedAt).toISOString()}>
              <DateFormat date={item.publishedAt} showFullDate />
            </time>
          </p>
        ) : null}

        <h1 className="text-foreground text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {item.title}
        </h1>
      </header>

      {item.coverImage ? (
        <img
          alt={item.coverImageAlt ?? ""}
          className="bg-muted aspect-video w-full rounded-lg object-cover"
          fetchPriority="high"
          height={item.coverImage.height}
          src={item.coverImage.url}
          width={item.coverImage.width}
        />
      ) : null}

      <div className="text-foreground leading-relaxed text-pretty">
        <EditorContent content={item.content} />
      </div>
    </article>
  );
};

export default BlogPostPage;
