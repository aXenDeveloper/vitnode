import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useRouter } from "@tanstack/react-router";
import { DateFormat } from "@vitnode/core/components/date-format";
import { HiddenIcon } from "@vitnode/core/components/hidden-icon";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { contentTarget } from "@vitnode/core/content";
import { resolveImageAlt } from "@vitnode/core/lib/files/resolve-alt";
import {
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { getIntlRuntime } from "@vitnode/core/tanstack/i18n";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { useRecordView } from "@vitnode/core/tanstack/search";
import { EyeOffIcon } from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { blogPostContentType } from "@/content/post";
import { manifest } from "@/manifest.gen";

import { BLOG_HREF } from "./blog-list";
import {
  blogArticleCoverTransition,
  blogArticleTitleTransition,
  BlogTransitionStyles,
  rememberBlogArticle,
} from "./blog-transitions";
import { blogPostQueryOptions } from "./post-query";

const loadBlogPost = async (
  queryClient: QueryClient,
  request: { locale: string; slug: string },
) =>
  contentDeliveryPage(await queryClient.query(blogPostQueryOptions(request)));

type BlogPostPageData = Awaited<ReturnType<typeof loadBlogPost>>;

export const route = defineRoute({
  load: async ({ context, params }) =>
    await loadBlogPost(context.queryClient, {
      locale: context.locale,
      slug: params.slug,
    }),

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

const BlogPostPage = ({
  loaderData: { item, metadata },
}: PluginRoutePageProps<BlogPostPageData>) => {
  const t = useTranslations("@vitnode/blog.post");
  const format = useFormatter();
  const router = useRouter();

  React.useEffect(() => {
    rememberBlogArticle(item.id);
  }, [item.id]);

  React.useEffect(() => {
    void router.preloadRoute({ to: BLOG_HREF } as Parameters<
      typeof router.preloadRoute
    >[0]);
  }, [router]);

  useRecordView({
    itemId: metadata.hidden ? null : metadata.itemId,
    itemType: blogPostContentType.id,
  });

  return (
    <article
      className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 md:gap-8 md:py-12"
      lang={metadata.locale ?? undefined}
    >
      <BlogTransitionStyles />
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.publishedAt ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("published")}{" "}
              <time dateTime={new Date(item.publishedAt).toISOString()}>
                <DateFormat date={item.publishedAt} showFullDate />
              </time>
            </p>
          ) : (
            <span />
          )}

          {!metadata.hidden && metadata.itemId !== null ? (
            <ReportButton
              className="text-muted-foreground"
              locale={metadata.locale}
              preview={{
                imageUrl: item.coverImage?.url ?? null,
                meta: item.publishedAt
                  ? format.dateTime(new Date(item.publishedAt), {
                      dateStyle: "medium",
                    })
                  : null,
                title: item.title,
              }}
              requestedLocale={metadata.requestedLocale}
              target={contentTarget(
                manifest.id,
                blogPostContentType,
                metadata.itemId,
              )}
              typeLabel={t("report_type")}
            />
          ) : null}
        </div>

        <h1
          className="text-foreground flex items-start gap-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl"
          style={blogArticleTitleTransition(item.id)}
        >
          {metadata.hidden ? (
            <HiddenIcon
              className="mt-1 size-7 md:mt-1.5 md:size-8"
              label={t("hidden.label")}
            />
          ) : null}
          {item.title}
        </h1>
      </header>

      {metadata.hidden ? (
        <Alert icon={<EyeOffIcon />} variant="warning">
          <AlertTitle>{t("hidden.title")}</AlertTitle>
          <AlertDescription>{t("hidden.desc")}</AlertDescription>
        </Alert>
      ) : null}

      {item.coverImage ? (
        <img
          alt={
            resolveImageAlt({
              alts: item.coverImage.alts,
              fallbackLocales: [getIntlRuntime().defaultLocale],
              locale: metadata.locale ?? getIntlRuntime().defaultLocale,
              occurrence: { alt: item.coverImageAlt },
            }).alt
          }
          className="bg-muted aspect-video w-full rounded-lg object-cover"
          decoding="async"
          fetchPriority="high"
          height={item.coverImage.height}
          // The article column: `max-w-3xl` less its `px-4` gutters.
          sizes="(min-width: 48rem) 46rem, calc(100vw - 2rem)"
          src={item.coverImage.url}
          style={blogArticleCoverTransition(item.id)}
          width={item.coverImage.width}
        />
      ) : null}

      <RichTextContent
        className="text-foreground leading-relaxed text-pretty"
        content={item.content}
      />
    </article>
  );
};

export default BlogPostPage;
