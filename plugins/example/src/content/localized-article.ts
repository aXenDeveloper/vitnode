import { defineContentType, field } from "@vitnode/core/content";

/**
 * The localization reference: one content type with both halves of the partition,
 * and - from Stage 5B - the whole editorial layer on top of it.
 *
 * `featured` is shared, so it lives on `example_localized_articles`. `title`,
 * `slug` and `body` are localized, so they live on
 * `example_localized_articles_translations` - one row per language, each with its
 * own `version`, its own `status`, its own `publishedAt` and its own revision
 * history, and a unique `(languageId, slug)` index so `/en/hello` and `/pl/hello`
 * can both exist while a second English `hello` is a 409.
 *
 * From Stage 5C it is public as well: `publicApi` exposes the localized `title`,
 * `slug` and `body` alongside the shared `featured`, and a public read resolves one
 * language - explicitly, negotiated or the default - with `fallback: "default"`
 * serving English to a locale that has no translation of its own. `search`
 * indexes one document per published translation rather than one per record.
 */
export const localizedArticleContentType = defineContentType({
  id: "example.localized-article",
  tableName: "example_localized_articles",

  localization: {
    enabled: true,
    // `en` has to exist in `core_languages`, which the boot guard checks once per
    // process. The Postgres suite inserts it (and `pl`) itself - nothing seeds
    // languages, they are created by the installer.
    defaultLocale: "en",
    // Acted on by the public read layer from Stage 5C. `"default"` so the
    // fixture carries the interesting value rather than the inert one: a locale
    // with no published translation is served the English copy, and says so in
    // the `locale` field of the response.
    fallback: "default",
  },

  // The global lifecycle every translation's own status is subordinate to:
  // publishing the English copy of a draft article puts nothing on the internet.
  publication: { enabled: true },

  /**
   * The public read layer, over both halves of the partition.
   *
   * `orderableFields` names shared columns only, and that is a rule rather than
   * an oversight: a list ordered by a localized title would reshuffle itself for
   * every language, and a cursor would mean two different positions across a
   * fallback set. `searchableFields` and `filterableFields` *may* name localized
   * fields - both are evaluated against the one translation the reader is being
   * served, so they can never match a language nobody will see.
   */
  publicApi: {
    enabled: true,
    path: "localized-articles",
    fields: ["title", "slug", "body", "featured", "publishedAt"],
    searchableFields: ["title", "body"],
    orderableFields: ["publishedAt"],
    filterableFields: ["featured", "slug"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },

  /**
   * One search document per **published** translation.
   *
   * `titleField` and `contentFields` name localized fields, which is the whole
   * point: an index built from the base row would hold no prose at all here,
   * since every text field on this content type is localized.
   *
   * `{locale}` in `pathTemplate` is required rather than optional - two languages
   * routinely answer to the same slug, so a template without it would give every
   * translation of a record the same link.
   */
  search: {
    enabled: true,
    titleField: "title",
    contentFields: ["title", "body"],
    pathTemplate: "/{locale}/localized-articles/{slug}",
  },

  // Per-locale versions, per-locale revisions, per-locale restore. `retention` is
  // per language, so five Polish revisions do not evict the English ones.
  // `preview` mints a link per language, freezing the shared revision and that
  // locale's translation revision together.
  editorial: {
    enabled: true,
    preview: { enabled: true, expiresInMinutes: 30 },
    revisions: { retention: 20 },
  },

  fields: {
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 200,
    }),
    // Derived from the *localized* title, per language. A slug sourced from a
    // shared field would give every language the same URL, which is why the
    // engine refuses that combination.
    slug: field.slug({ localized: true, source: "title" }),
    body: field.textarea({ localized: true, required: true }),

    // Shared: whether an article is featured is a property of the article, not
    // of the language somebody is reading it in.
    featured: field.boolean({ defaultValue: false }),
  },

  admin: {
    list: {
      // Shared columns only. A localized field is not a column on the base
      // table, so naming one here is a compile error as well as a runtime one.
      // The AdminCP's locale selector is what shows a localized title.
      columns: ["featured", "status", "updatedAt"],
      orderableFields: ["featured"],
    },
  },
});
