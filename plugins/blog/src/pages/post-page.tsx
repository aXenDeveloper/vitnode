import type { QueryClient } from "@tanstack/react-query";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useRouter } from "@tanstack/react-router";
import { SharePopover } from "@vitnode/core/components/share-popover";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
import {
  TooltipGroup,
  TooltipGroupTrigger,
} from "@vitnode/core/components/ui/tooltip";
import { contentTarget } from "@vitnode/core/content";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  autoTranslateItem,
  AutoTranslateNote,
  AutoTranslateScope,
  loadAutoTranslateSnapshot,
  useAutoTranslation,
} from "@vitnode/core/tanstack/auto-translate";
import {
  ContentAccessRequired,
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { ReactionBar } from "@vitnode/core/tanstack/reactions";
import { useRecordView } from "@vitnode/core/tanstack/search";
import { ArrowLeftIcon, Share2Icon } from "lucide-react";
import React from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

import { blogPostContentType } from "@/content/post";
import { manifest } from "@/manifest.gen";

import type { BlogCategories } from "./blog-queries";

import { BLOG_HREF } from "./blog-list";
import { blogPostHref } from "./blog-post-href";
import { blogCategoriesQueryOptions } from "./blog-queries";
import { rememberBlogArticle } from "./blog-transitions";
import { BlogArticle } from "./post-article";
import { PostComments } from "./post-comments";
import {
  postCommentAutoTranslateItem,
  postCommentsQueryOptions,
} from "./post-comments-data";
import { blogPostQueryOptions } from "./post-query";

const loadBlogPost = async (
  queryClient: QueryClient,
  request: { locale: string; slug: string },
) => {
  const [answer, categories] = await Promise.all([
    queryClient.query(blogPostQueryOptions(request)),
    queryClient
      .query({
        ...blogCategoriesQueryOptions(request.locale),
        meta: LOADER_DATA_QUERY_META,
      })
      .catch((): BlogCategories => ({ items: [], total: 0 })),
  ]);

  if (answer.accessRequired) return { accessRequired: true as const };

  const page = contentDeliveryPage(answer);
  const comments = page.metadata.hidden
    ? null
    : await queryClient
        .infiniteQuery(postCommentsQueryOptions(page.item.id))
        .catch(() => null);
  const translations = page.metadata.hidden
    ? null
    : await loadAutoTranslateSnapshot(queryClient, {
        items: [
          autoTranslateItem(
            blogPostContentType.id,
            page.item.id,
            { content: page.item.content },
            { recordLocale: page.item.locale },
          ),
          ...(comments?.pages ?? []).flatMap(commentPage =>
            commentPage.items.flatMap(node =>
              node.record ? [postCommentAutoTranslateItem(node.record)] : [],
            ),
          ),
        ],
        locale: request.locale,
      });
  // Only the article's own categories count, all of them: commenting needs
  // every one to allow it. A category missing from the list is one the reader
  // may not see, and then the article would not have loaded at all.
  const canComment = page.item.categoryId.every(
    id =>
      categories.items.find(category => category.id === id)?.access
        .canComment === true,
  );

  return {
    ...page,
    accessRequired: false as const,
    canComment,
    categories: categories.items,
    translations,
  };
};

type BlogPostPageData = Awaited<ReturnType<typeof loadBlogPost>>;

type BlogPostArticleData = Extract<BlogPostPageData, { accessRequired: false }>;

export const route = defineRoute({
  load: async ({ context, params }) =>
    await loadBlogPost(context.queryClient, {
      locale: context.locale,
      slug: params.slug,
    }),

  head: ({ loaderData, t }) =>
    loaderData?.accessRequired
      ? {
          robots: "noindex, nofollow",
          title: t("@vitnode/blog.post.access_required"),
        }
      : contentDeliveryPageHead(loaderData?.metadata, {
          title: loaderData?.item.title,
        }),
});

const BlogPostAccessRequired = () => {
  const t = useTranslations("@vitnode/blog.post");

  return (
    <div className="container mx-auto flex max-w-3xl px-4 py-8 md:py-12">
      <ContentAccessRequired>
        <HrefLink
          className={buttonVariants({ variant: "outline" })}
          href={BLOG_HREF}
        >
          <ArrowLeftIcon aria-hidden="true" />
          {t("back")}
        </HrefLink>
      </ContentAccessRequired>
    </div>
  );
};

const BlogPostPage = ({ loaderData }: PluginRoutePageProps<BlogPostPageData>) =>
  loaderData.accessRequired ? (
    <BlogPostAccessRequired />
  ) : (
    <AutoTranslateScope initial={loaderData.translations}>
      <BlogPostArticle loaderData={loaderData} />
    </AutoTranslateScope>
  );

const BlogPostArticle = ({
  loaderData: { canComment, categories, item, metadata },
}: {
  loaderData: BlogPostArticleData;
}) => {
  const t = useTranslations("@vitnode/blog.post");
  const readerLocale = useLocale();
  const { elementRef, ...translation } = useAutoTranslation({
    contentTypeId: blogPostContentType.id,
    fields: { content: item.content },
    id: item.id,
    recordLocale: item.locale,
  });
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

  const articleAuthorIds = React.useMemo(
    () => item.authorId.map(author => author.id),
    [item.authorId],
  );

  useRecordView({
    itemId: metadata.hidden ? null : metadata.itemId,
    itemType: blogPostContentType.id,
  });

  return (
    <BlogArticle
      categories={categories}
      contentLocale={translation.isTranslated ? readerLocale : null}
      elementRef={elementRef}
      footer={
        !metadata.hidden && metadata.itemId !== null ? (
          <>
            <ReactionBar
              target={contentTarget(
                manifest.id,
                blogPostContentType,
                metadata.itemId,
              )}
            />
            <div className="ms-auto flex items-center gap-1">
              <TooltipGroup>
                <SharePopover
                  title={item.title}
                  url={blogPostHref(item.friendlyUrl)}
                >
                  <TooltipGroupTrigger
                    content={t("share")}
                    render={
                      <Button
                        aria-label={t("share")}
                        className="text-muted-foreground"
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <Share2Icon aria-hidden="true" />
                  </TooltipGroupTrigger>
                </SharePopover>
              </TooltipGroup>
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
            </div>
          </>
        ) : null
      }
      hidden={metadata.hidden}
      item={{ ...item, content: translation.values.content }}
      locale={metadata.locale}
      note={<AutoTranslateNote translation={translation} />}
    >
      {metadata.itemId !== null ? (
        <PostComments
          articleAuthorIds={articleAuthorIds}
          articleHref={blogPostHref(item.friendlyUrl)}
          articleId={item.id}
          articleTitle={item.title}
          canComment={canComment}
        />
      ) : null}
    </BlogArticle>
  );
};

export default BlogPostPage;
