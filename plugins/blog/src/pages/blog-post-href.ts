import { contentDeliveryInternalPath } from "@vitnode/core/content";

import { blogPostContentType } from "@/content/post";

/** The article's own page, before the reader's locale prefix. */
export const blogPostHref = (slug: string): string =>
  contentDeliveryInternalPath({ definition: blogPostContentType, slug }) ??
  `/blog/article/${encodeURIComponent(slug)}`;
