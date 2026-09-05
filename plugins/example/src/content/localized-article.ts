import { defineContentType, field } from "@vitnode/core/content";

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
