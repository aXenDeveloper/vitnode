import type { QueryClient } from "@tanstack/react-query";
import type { RichTextNodeRenderer } from "@vitnode/core/components/rich-text";
import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { useRouter } from "@tanstack/react-router";
import { Avatar } from "@vitnode/core/components/avatar";
import { DateFormat } from "@vitnode/core/components/date-format";
import { HiddenIcon } from "@vitnode/core/components/hidden-icon";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { TooltipWithContent } from "@vitnode/core/components/ui/tooltip";
import { UserFormat } from "@vitnode/core/components/user-format";
import { contentTarget } from "@vitnode/core/content";
import { richTextNodeElement } from "@vitnode/core/content/rich-text";
import { resolveImageAlt } from "@vitnode/core/lib/files/resolve-alt";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import {
  ContentAccessRequired,
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { getIntlRuntime } from "@vitnode/core/tanstack/i18n";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { useRecordView } from "@vitnode/core/tanstack/search";
import { cn } from "cn";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  EyeOffIcon,
  TextAlignStartIcon,
} from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { blogPostContentType } from "@/content/post";
import { manifest } from "@/manifest.gen";

import type { BlogCategories, BlogCategory } from "./blog-queries";
import type { PostOutline } from "./post-outline";

import { BlogCategorySwatch, categoryBorder, categoryStyle } from "./blog-card";
import { BLOG_HREF, blogCategoryHref } from "./blog-list";
import { blogPostHref } from "./blog-post-href";
import { blogCategoriesQueryOptions } from "./blog-queries";
import {
  blogArticleCoverTransition,
  blogArticleTitleTransition,
  BlogTransitionStyles,
  rememberBlogArticle,
} from "./blog-transitions";
import { PostComments } from "./post-comments";
import { postOutline, postReadingMinutes } from "./post-outline";
import { blogPostQueryOptions } from "./post-query";
import { PostToc } from "./post-toc";

const EDITED_AFTER_MS = 60 * 60 * 1000;

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
  };
};

type BlogPostPageData = Awaited<ReturnType<typeof loadBlogPost>>;

type BlogPostArticleData = Extract<BlogPostPageData, { accessRequired: false }>;

type BlogPostItem = BlogPostArticleData["item"];

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

const headingRenderer =
  (outline: PostOutline): RichTextNodeRenderer =>
  ({ children, node }) => {
    const element = richTextNodeElement(node);

    return React.createElement(
      element?.tag ?? "h2",
      {
        className: "scroll-mt-28 outline-none",
        id: outline.headingId(node),
        style: element?.style,
        tabIndex: -1,
      },
      children,
    );
  };

const PostCategories = ({ categories }: { categories: BlogCategory[] }) => {
  const t = useTranslations("@vitnode/blog.post");
  if (categories.length === 0) return null;

  return (
    <ul
      aria-label={t("categories")}
      className="flex flex-wrap justify-center gap-1.5"
    >
      {categories.map(category => (
        <li key={category.id}>
          <HrefLink
            className="text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3"
            href={blogCategoryHref(category.slug)}
            preload="intent"
            style={{ ...categoryStyle(category), borderColor: categoryBorder }}
          >
            <BlogCategorySwatch category={category} />
            {category.name}
          </HrefLink>
        </li>
      ))}
    </ul>
  );
};

const PostAuthors = ({ authors }: { authors: BlogPostItem["authorId"] }) => {
  const t = useTranslations("@vitnode/blog.post");
  const format = useFormatter();
  if (authors.length === 0) return null;

  return (
    <div className="flex items-center gap-2.5">
      <span className="isolate flex shrink-0">
        {authors.map((author, index) => (
          <Avatar
            alt=""
            className={cn(
              "ring-background relative ring-2",
              index > 0 && "-ms-2",
            )}
            key={author.id}
            size={28}
            style={{ zIndex: authors.length - index }}
            user={author}
          />
        ))}
      </span>
      <p className="text-start text-balance">
        <span className="sr-only">{t("by")} </span>
        {format.list(
          authors.map(author => (
            <UserFormat
              className="text-foreground align-bottom"
              format
              key={author.id}
              link
              title={author.name}
              user={author}
            />
          )),
          { type: "conjunction" },
        )}
      </p>
    </div>
  );
};

const PostDates = ({ item }: { item: BlogPostItem }) => {
  const t = useTranslations("@vitnode/blog.post");
  const format = useFormatter();
  const minutes = postReadingMinutes(item.content);
  const published = item.publishedAt ? new Date(item.publishedAt) : null;
  const updated = new Date(item.updatedAt);
  const isEdited =
    published !== null &&
    updated.getTime() - published.getTime() > EDITED_AFTER_MS;

  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 tabular-nums">
      {published ? (
        <>
          <span>
            <span className="sr-only">{t("published")} </span>
            <TooltipWithContent
              text={format.dateTime(published, {
                dateStyle: "full",
                timeStyle: "short",
              })}
            >
              <time dateTime={published.toISOString()}>
                {format.dateTime(published, { dateStyle: "long" })}
              </time>
            </TooltipWithContent>
          </span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      {isEdited ? (
        <>
          <span>
            {t("edited")} <DateFormat date={updated} />
          </span>
          <span aria-hidden="true">·</span>
        </>
      ) : null}
      <span>{t("reading_time", { minutes })}</span>
    </p>
  );
};

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

const BlogPostPage = ({
  loaderData,
}: PluginRoutePageProps<BlogPostPageData>) =>
  loaderData.accessRequired ? (
    <BlogPostAccessRequired />
  ) : (
    <BlogPostArticle loaderData={loaderData} />
  );

const BlogPostArticle = ({
  loaderData: { canComment, categories, item, metadata },
}: {
  loaderData: BlogPostArticleData;
}) => {
  const t = useTranslations("@vitnode/blog.post");
  const format = useFormatter();
  const router = useRouter();
  const outline = React.useMemo(
    () => postOutline(item.content),
    [item.content],
  );
  const nodes = React.useMemo(
    () => ({ heading: headingRenderer(outline) }),
    [outline],
  );
  const postCategories = item.categoryId.flatMap(id => {
    const category = categories.find(entry => entry.id === id);

    return category ? [category] : [];
  });
  const hasToc = outline.headings.length > 0;

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
    <article
      className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 md:gap-14 md:py-12"
      lang={metadata.locale ?? undefined}
    >
      <BlogTransitionStyles />
      <header className="flex flex-col items-center gap-5 text-center">
        <HrefLink
          className="text-primary hover:text-primary/80 focus-visible:ring-ring/50 group/back inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-3"
          href={BLOG_HREF}
        >
          <ArrowLeftIcon
            aria-hidden="true"
            className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5 motion-reduce:transition-none rtl:rotate-180"
          />
          {t("back")}
        </HrefLink>

        <PostCategories categories={postCategories} />

        <h1
          className="text-foreground max-w-4xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl md:text-5xl"
          style={blogArticleTitleTransition(item.id)}
        >
          {metadata.hidden ? (
            <HiddenIcon
              className="me-3 size-7 align-middle md:size-9"
              label={t("hidden.label")}
            />
          ) : null}
          {item.title}
        </h1>

        <div className="text-muted-foreground flex flex-col items-center gap-3 text-sm leading-relaxed">
          <PostAuthors authors={item.authorId} />
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <PostDates item={item} />
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
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,48rem)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-10 lg:col-start-2 lg:row-start-1">
          {metadata.hidden ? (
            <Alert icon={<EyeOffIcon />} variant="warning">
              <AlertTitle>{t("hidden.title")}</AlertTitle>
              <AlertDescription>{t("hidden.desc")}</AlertDescription>
            </Alert>
          ) : null}

          {hasToc ? (
            <details className="group bg-card text-card-foreground rounded-lg border lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <TextAlignStartIcon
                    aria-hidden="true"
                    className="text-muted-foreground size-4 shrink-0"
                  />
                  {t("on_this_page")}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <nav aria-label={t("on_this_page")} className="px-4 pb-4">
                <PostToc headings={outline.headings} />
              </nav>
            </details>
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
              className="bg-muted aspect-video w-full rounded-xl object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              decoding="async"
              fetchPriority="high"
              height={item.coverImage.height}
              sizes="(min-width: 64rem) 48rem, calc(100vw - 2rem)"
              src={item.coverImage.url}
              style={blogArticleCoverTransition(item.id)}
              width={item.coverImage.width}
            />
          ) : null}

          <RichTextContent
            className="text-foreground leading-relaxed text-pretty"
            content={item.content}
            nodes={nodes}
          />
        </div>

        {hasToc ? (
          <aside className="hidden lg:col-start-3 lg:row-start-1 lg:block">
            <nav
              aria-label={t("on_this_page")}
              className="sticky top-24 flex max-w-60 flex-col gap-4"
            >
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <TextAlignStartIcon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                />
                {t("on_this_page")}
              </p>
              <PostToc headings={outline.headings} />
            </nav>
          </aside>
        ) : null}

        {metadata.itemId !== null ? (
          <div className="min-w-0 lg:col-start-2 lg:row-start-2">
            <PostComments
              articleAuthorIds={articleAuthorIds}
              articleHref={blogPostHref(item.friendlyUrl)}
              articleId={item.id}
              articleTitle={item.title}
              canComment={canComment}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
};

export default BlogPostPage;
