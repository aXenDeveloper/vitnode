import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { LOADER_DATA_QUERY_META } from "@vitnode/core/lib/query-client";
import { RECORD_STALE_TIME } from "@vitnode/core/lib/query-freshness";
import { contentPageItem } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { localizeHref } from "@vitnode/core/tanstack/i18n";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import { blogPostHref } from "./blog-post-href";
import { commentAnchorId } from "./post-comments-data";
import { blogQueryKeys } from "./post-query";

const zodCommentLink = z.object({
  article: z.object({ id: z.number() }),
  slug: z.string(),
});

const commentLinkQueryOptions = (request: { locale: string; slug: string }) =>
  queryOptions({
    meta: LOADER_DATA_QUERY_META,
    queryFn: async () => {
      const comment = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "content/comments",
        path: "/{slug}",
        args: { params: { slug: encodeURIComponent(request.slug) } },
      });

      if (comment.status === 404) return null;
      if (comment.status !== 200) {
        throw new Error(`Resolving the comment "${request.slug}" failed.`);
      }

      const record = zodCommentLink.parse(await comment.json());
      const article = await fetcher({
        plugin: manifest.id,
        method: "get",
        module: "posts",
        path: "/{id}/slug",
        args: {
          params: { id: record.article.id },
          query: { locale: request.locale },
        },
      });

      if (article.status === 404) return null;
      if (article.status !== 200) {
        throw new Error(
          `Resolving the article of the comment "${request.slug}" failed.`,
        );
      }

      return { article: (await article.json()).slug, comment: record.slug };
    },
    queryKey: blogQueryKeys.commentLink(request),
    staleTime: ({ state }) => (state.data ? RECORD_STALE_TIME : 0),
  });

export const route = defineRoute({
  load: async ({ context, params }) => {
    const { article, comment } = contentPageItem(
      await context.queryClient.query(
        commentLinkQueryOptions({ locale: context.locale, slug: params.slug }),
      ),
    );

    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: `${localizeHref(blogPostHref(article), context.locale)}#${commentAnchorId(comment)}`,
      statusCode: 302,
    });
  },

  head: () => ({ robots: "noindex, nofollow" }),
});

const CommentRedirectPage = () => null;

export default CommentRedirectPage;
