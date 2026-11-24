/**
 * Apart from `post-preview.ts` on purpose: `routes.ts` imports this, and what
 * `routes.ts` imports ships in every page's entry bundle.
 */
export interface BlogPostPreviewSearch {
  locale?: string;
}

export const blogPostPreviewSearch = (
  input: Record<string, unknown>,
): BlogPostPreviewSearch =>
  typeof input.locale === "string" && input.locale !== ""
    ? { locale: input.locale }
    : {};
