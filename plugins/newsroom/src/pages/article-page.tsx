import type { PluginRoutePageProps } from "@vitnode/core/routing";

import { DateFormat } from "@vitnode/core/components/date-format";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import { contentTarget, zodRichTextDocument } from "@vitnode/core/content";
import {
  contentDeliveryPage,
  contentDeliveryPageHead,
} from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { ReportButton } from "@vitnode/core/tanstack/moderation";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { articleContentType } from "@/content/article";
import { manifest } from "@/manifest.gen";

import { articlesQueryOptions } from "./article-list";
import { useArticlePermissions } from "./article-permissions";
import { commentsQueryOptions } from "./comment-data";
import { CommentSection } from "./comment-section";
import { LatestArticles } from "./latest-articles";

const zodArticle = z.object({
  body: zodRichTextDocument,
  id: z.number(),
  publishedAt: z.string().nullable(),
  slug: z.string(),
  title: z.string(),
});

const loadArticle = async (slug: string) => {
  const [resolution, detail] = await Promise.all([
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/news",
      path: "/delivery/resolve/{slug}",
      args: { params: { slug: encodeURIComponent(slug) } },
    }),
    fetcher({
      plugin: manifest.id,
      method: "get",
      module: "content/news",
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
    item: detail.status === 200 ? zodArticle.parse(await detail.json()) : null,
    resolution: await resolution.json(),
  });
};

type ArticlePageData = Awaited<ReturnType<typeof loadArticle>>;

export const route = defineRoute({
  load: async ({ context, params }) => {
    const page = await loadArticle(params.slug);
    await Promise.all([
      // The first page of comments arrives with the article's HTML. A failure
      // leaves the section to show its own error instead of breaking the page.
      context.queryClient
        .infiniteQuery(commentsQueryOptions(page.item.id))
        .catch(() => null),
      // Same options as the first page of /news. A failure leaves the box to
      // retry in the browser instead of breaking the article.
      context.queryClient
        .query(articlesQueryOptions({ locale: context.locale, search: {} }))
        .catch(() => null),
    ]);

    return page;
  },

  head: ({ loaderData }) =>
    contentDeliveryPageHead(loaderData?.metadata, {
      title: loaderData?.item.title,
    }),
});

/** Asked in the browser, so the cached page stays the same for everyone. */
const ArticleActions = ({ id, title }: { id: number; title: string }) => {
  const t = useTranslations("newsroom.articles");
  const { canEdit, canReport } = useArticlePermissions([id]).of(id);

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit ? (
        <HrefLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={`/news/${id}/edit`}
        >
          {t("edit_link")}
        </HrefLink>
      ) : null}
      {canReport ? (
        <ReportButton
          preview={{ title }}
          target={contentTarget(manifest.id, articleContentType, id)}
          typeLabel={t("report_type")}
        />
      ) : null}
    </div>
  );
};

const ArticlePage = ({
  loaderData: { item },
}: PluginRoutePageProps<ArticlePageData>) => (
  <div className="container mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          {item.title}
        </h1>
        {item.publishedAt ? (
          <span className="text-muted-foreground text-sm">
            <DateFormat date={item.publishedAt} />
          </span>
        ) : null}
        <ArticleActions id={item.id} title={item.title} />
      </header>

      <RichTextContent
        className="leading-relaxed text-pretty"
        content={item.body}
      />

      <CommentSection articleId={item.id} articleSlug={item.slug} />
    </article>

    <LatestArticles currentId={item.id} />
  </div>
);

export default ArticlePage;
