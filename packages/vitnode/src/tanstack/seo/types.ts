/**
 * Search and AI-training crawler choices for one vendor that runs separate
 * bots for search and for training. `true` adds a group for that bot that
 * allows the site with the same exclusions as `User-agent: *`; `false` adds
 * `Disallow: /` for it; leaving it out adds no group, so the bot follows
 * `User-agent: *`.
 */
export interface VitNodeSeoCrawlerPair {
  /** The vendor's search crawler (results and citations). */
  search?: boolean;
  /** The vendor's crawler that collects training data. */
  training?: boolean;
}

/**
 * Per-bot rules written to `/robots.txt`. Directives express a policy that
 * well-behaved crawlers follow; they do not block HTTP access. User-initiated
 * fetches (a person asking an assistant to open a page) are outside this
 * contract.
 */
export interface VitNodeSeoCrawlersConfig {
  /** Anthropic: `search` maps to `Claude-SearchBot`, `training` to `ClaudeBot`. */
  anthropic?: VitNodeSeoCrawlerPair;
  /**
   * Google's `Google-Extended` token: whether Gemini may use the site for
   * training and grounding, as Google describes it. It never changes Google
   * Search crawling or ranking.
   */
  googleExtended?: boolean;
  /** OpenAI: `search` maps to `OAI-SearchBot`, `training` to `GPTBot`. */
  openai?: VitNodeSeoCrawlerPair;
}

/** The generated sitemap: `/sitemap.xml` and its child files. */
export interface VitNodeSeoSitemapConfig {
  /**
   * Publishes `/sitemap.xml` and the `Sitemap:` line in `/robots.txt`.
   * Defaults to the value of `indexing`; `indexing: false` always hides it.
   */
  enabled?: boolean;
  /**
   * The app's own canonical, public, indexable pages, as unlocalized paths
   * (`"/"`, `"/plugins"`). Each is listed once per locale with its locale
   * prefix or domain applied and `hreflang` alternates. Content Engine
   * records with `delivery.sitemap` are added on their own - do not list them.
   * A path must start with `/` and carry no query, hash, `.`/`..` segment or
   * locale prefix, and must not be under `/admin` or `/api`; a trailing slash
   * is dropped and duplicates are merged. Defaults to `[]`.
   */
  paths?: readonly string[];
}

/**
 * Site-wide search indexing, sitemap and crawler policy, set in
 * `buildServerConfig({ seo })` and served by `withSeo` from
 * `@vitnode/core/tanstack/seo/server`. Changes apply on the next deployment.
 *
 * Leaving `seo` out keeps the app as it was: no generated `/robots.txt` or
 * sitemap, no `X-Robots-Tag` - an app that serves its own files keeps them.
 *
 * @example
 * ```ts
 * seo: {
 *   indexing: process.env.VITNODE_SEO_INDEXING === "true",
 *   sitemap: { paths: ["/", "/about"] },
 *   crawlers: { openai: { training: false } },
 * }
 * ```
 */
export interface VitNodeSeoConfig {
  /** Per-bot rules. Each omitted bot follows `User-agent: *`. */
  crawlers?: VitNodeSeoCrawlersConfig;
  /**
   * Required. `true` lets search engines index the site. `false` adds
   * `X-Robots-Tag: noindex` to every HTML response (and a robots `<meta>` to
   * prerendered pages), hides the sitemap and keeps pages crawlable so search
   * engines can read the directive. There is no default, so a preview
   * deployment can never become indexable by omission.
   */
  indexing: boolean;
  /** The generated sitemap. See {@link VitNodeSeoSitemapConfig}. */
  sitemap?: VitNodeSeoSitemapConfig;
}
