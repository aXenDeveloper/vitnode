/**
 * One content type whose records the generated sitemap lists, as the VitNode
 * Vite plugin writes it into `src/sitemap-sources.gen.ts`: every content type
 * of a configured plugin with a public API, `delivery` and `delivery.sitemap`.
 */
export interface SeoContentSitemapSource {
  /** The content type's id, e.g. `blog.post`. Its cache tags are keyed on it. */
  contentTypeId: string;
  /**
   * The child sitemap name stem, unique in the app: `blog` gives
   * `/sitemap-blog-1.xml`, or `/sitemap-blog-pl-1.xml` per locale.
   */
  file: string;
  /** Whether each locale is its own file, read with `?locale=`. */
  localized: boolean;
  /** The public API module, `content/<publicApi.path>`. */
  module: string;
  /** The delivery sitemap route within `module`. */
  path: "/delivery/sitemap";
  /** The plugin id the module is mounted under, e.g. `@vitnode/blog`. */
  pluginId: string;
}

/** What `src/sitemap-sources.gen.ts` exports. */
export interface SeoSitemapManifest {
  /** Changes with every build, so a deployment never serves another's XML. */
  revision: string;
  sources: readonly SeoContentSitemapSource[];
}

/** A child sitemap name stem: lowercase letters, digits and single dashes. */
export const SEO_SITEMAP_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `/sitemap-{file}-{part}.xml`, `part` counted from 1. */
export const seoSitemapChildPath = (file: string, part: number): string =>
  `/sitemap-${file}-${String(part)}.xml`;

/** The `{file}` and `{part}` of a child sitemap path, or `null`. */
export const parseSeoSitemapChildPath = (
  pathname: string,
): null | { file: string; part: number } => {
  const match = /^\/sitemap-([a-z0-9-]+)-([1-9]\d{0,5})\.xml$/.exec(pathname);
  if (!match) return null;

  return { file: match[1], part: Number(match[2]) };
};

/** `"@vitnode/blog"` -> `"vitnode-blog"`, `"Content/Blog_Posts"` -> `"content-blog-posts"`. */
export const seoSitemapSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
