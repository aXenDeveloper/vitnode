import { defineContentType, field } from "@vitnode/core/content";

/**
 * The Stage 5A reference: one content type with both halves of the partition.
 *
 * `featured` is shared, so it lives on `example_localized_articles`. `title`,
 * `slug` and `body` are localized, so they live on
 * `example_localized_articles_translations` - one row per language, each with its
 * own `version`, and a unique `(languageId, slug)` index so `/en/hello` and
 * `/pl/hello` can both exist while a second English `hello` is a 409.
 *
 * Deliberately minimal on every other axis. `publication`, `editorial`,
 * `publicApi` and `search` are all refused alongside `localization` in Stage 5A -
 * see the boundaries in `resolveContentLocalization` - so this fixture exercises
 * the tables, the schemas, the services and the routes and nothing else. It is
 * registered on the API side only: the AdminCP locale tabs that would give
 * `title` somewhere to be edited are Stage 5B.
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
    // The safest default, and the only one Stage 5A can honestly claim: nothing
    // reads through the fallback yet, and Stage 5C is where it starts to.
    fallback: "none",
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
    label: {
      plural: "Example Localized Articles",
      singular: "Example Localized Article",
    },
    list: {
      // Shared columns only. A localized field is not a column on the base
      // table, so naming one here is a compile error as well as a runtime one.
      columns: ["featured", "updatedAt"],
      orderableFields: ["featured"],
    },
  },
});
