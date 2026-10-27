import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { CONTENT_COMMENT_ANCHOR_PREFIX } from "@vitnode/core/tanstack/comments";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { localizeHref } from "@vitnode/core/tanstack/i18n";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

const zodCommentLink = z.object({
  article: z.object({ id: z.number() }),
  id: z.number(),
});

/** Where a comment's permalink leads: its article's slug and the comment's id. */
const commentLinkQueryOptions = (slug: string) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const comment = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/article-comments",
        path: "/{slug}",
        args: { params: { slug: encodeURIComponent(slug) } },
      });
      if (comment.status === 404) return null;
      if (comment.status !== 200) {
        throw new Error(`Resolving the comment "${slug}" failed.`);
      }

      const record = zodCommentLink.parse(await comment.json());
      const article = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "articles",
        path: "/{id}/slug",
        args: { params: { id: record.article.id } },
      });
      if (article.status === 404) return null;
      if (article.status !== 200) {
        throw new Error(
          `Resolving the article of the comment "${slug}" failed.`,
        );
      }

      return { article: (await article.json()).slug, comment: record.id };
    },
    queryKey: [manifest.id, "comment-link", slug],
  });

export const route = defineRoute({
  load: async ({ context, params }) => {
    const { article, comment } = contentPageItem(
      await context.queryClient.query(commentLinkQueryOptions(params.slug)),
    );

    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: `${localizeHref(`/news/${article}`, context.locale)}#${CONTENT_COMMENT_ANCHOR_PREFIX}${comment}`,
      statusCode: 302,
    });
  },

  head: () => ({ robots: "noindex, nofollow" }),
});

const CommentRedirectPage = () => null;

export default CommentRedirectPage;
