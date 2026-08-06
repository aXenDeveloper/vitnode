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
 * `publicApi` and `search` are still absent: both remain refused alongside
 * `localization` until Stage 5C and Stage 5D respectively - see the boundaries in
 * `resolveContentLocalization`. So this fixture exercises the tables, the schemas,
 * the services, the per-locale lifecycle, the per-locale history and the generated
 * routes, and nothing that reads outwards.
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
    // Resolved here, acted on in Stage 5C. `"default"` so the fixture carries the
    // interesting value rather than the inert one.
    fallback: "default",
  },

  // The global lifecycle every translation's own status is subordinate to:
  // publishing the English copy of a draft article puts nothing on the internet.
  publication: { enabled: true },

  // Per-locale versions, per-locale revisions, per-locale restore. `retention` is
  // per language, so five Polish revisions do not evict the English ones.
  editorial: { enabled: true, revisions: { retention: 20 } },

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
    label: {
      plural: "Example Localized Articles",
      singular: "Example Localized Article",
    },
    list: {
      // Shared columns only. A localized field is not a column on the base
      // table, so naming one here is a compile error as well as a runtime one.
      // The AdminCP's locale selector is what shows a localized title.
      columns: ["featured", "status", "updatedAt"],
      orderableFields: ["featured"],
    },
  },
});
