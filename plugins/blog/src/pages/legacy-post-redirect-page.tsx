import { redirect } from "@tanstack/react-router";
import { contentDeliveryPage } from "@vitnode/core/tanstack/content";
import { localizeHref } from "@vitnode/core/tanstack/i18n";
import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";

import { blogPostHref } from "./blog-post-href";
import { blogPostQueryOptions } from "./post-query";

export const route = defineRoute({
  load: async ({ context, params }) => {
    const { metadata } = contentDeliveryPage(
      await context.queryClient.query(
        blogPostQueryOptions({ locale: context.locale, slug: params.slug }),
      ),
    );

    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href:
        metadata.canonicalPath ??
        localizeHref(blogPostHref(params.slug), context.locale),
      statusCode: 308,
    });
  },

  head: () => ({ robots: "noindex, nofollow" }),
});

const LegacyPostRedirectPage = () => null;

export default LegacyPostRedirectPage;
