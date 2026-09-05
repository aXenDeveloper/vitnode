import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

export const advancedArticleContentType = defineContentType({
  id: "example.advanced-article",
  tableName: "example_advanced_articles",

  localization: {
    enabled: true,
    defaultLocale: "en",
    fallback: "default",
  },

  publication: { enabled: true },

  editorial: {
    enabled: true,
    revisions: { retention: 20 },
    preview: { enabled: true, expiresInMinutes: 30 },
  },

  fields: {
    title: field.text({
      localized: true,
      required: true,
      minLength: 3,
      maxLength: 200,
    }),
    slug: field.slug({ localized: true, source: "title" }),

    // Unordered: a set of categories has no natural first one, so the engine
    // stores it in ascending target-id order and `set([9, 2])` and `set([2, 9])`
    // are the same state rather than two writes.
    categories: field.relation({
      multiple: true,
      onDelete: "restrict",
      target: () => categoryContentType,
    }),

    // A self-relation, and an ordered one: "read next" is a sequence somebody
    // chose. `onDelete: "cascade"` drops the reference when the target article
    // goes, which is the honest analogue of nulling a column here.
    relatedArticles: field.relation({
      multiple: true,
      onDelete: "cascade",
      ordered: true,
      self: true,
    }),

    // Localized whole: both leaves move to the translation table together, with
    // one revision history and one permission between them.
    seo: field.group({
      localized: true,
      nullable: true,
      fields: {
        // Nullable because the group is: `seo: null` has to be able to blank
        // every leaf, and it cannot do that to a NOT NULL column.
        title: field.text({ nullable: true, maxLength: 200 }),
        description: field.textarea({ nullable: true, maxLength: 500 }),
      },
    }),

    // Shared: whether a search engine should index the article, and how
    // important it is, are properties of the article rather than of a language.
    syndication: field.group({
      fields: {
        indexable: field.boolean({ defaultValue: true }),

        noIndex: field.boolean({ defaultValue: false }),
        priority: field.number({
          integer: true,
          min: 0,
          max: 10,
          defaultValue: 5,
        }),
      },
    }),

    // Shared, like every repeatable in Stage 6.
    faq: field.repeatable({
      max: 20,
      fields: {
        question: field.text({ required: true, minLength: 3, maxLength: 200 }),
        answer: field.textarea({ required: true }),
      },
    }),
  },

  publicApi: {
    enabled: true,
    path: "advanced-articles",
    fields: [
      // Exposed because Stage 8 needs it: alternates and `hreflang` are resolved by
      // identifier, and delivery reads the public projection - so a localized
      // delivery content type that withheld `id` would carry an empty alternate set.
      "id",
      "title",
      "slug",
      "categories",
      "seo.title",
      "seo.description",
      "syndication.priority",
      // Public because delivery projects it: `robots: { index: false }` is rendered
      // into the page, so the field it comes from has to be something the public API
      // would already have said out loud.
      "syndication.noIndex",
      "faq.question",
      "faq.answer",
      "publishedAt",
    ],
    searchableFields: ["title", "seo.title"],
    orderableFields: ["publishedAt", "syndication.priority"],
    filterableFields: ["categories", "slug"],
    defaultOrderBy: "publishedAt",
    defaultOrder: "desc",
  },

  search: {
    enabled: true,
    titleField: "title",
    descriptionField: "seo.description",
    contentFields: ["title", "seo.description", "faq.question", "faq.answer"],
    pathTemplate: "/{locale}/advanced-articles/{slug}",
  },

  delivery: {
    enabled: true,
    redirects: { enabled: true },
    hreflang: { xDefault: "defaultLocale" },
    seo: {
      titleField: "seo.title",
      fallbackTitleField: "title",
      descriptionField: "seo.description",
      noIndexField: "syndication.noIndex",
      openGraph: {
        titleField: "seo.title",
        descriptionField: "seo.description",
      },
    },
    sitemap: { enabled: true, changeFrequency: "weekly", priority: 0.7 },
  },

  // Leaf paths, materialised against the generated columns: this compiles to an
  // index on `syndicationPriority`, exactly as `{ on: ["priority"] }` would have
  // if `priority` were a top-level field.
  indexes: [{ on: ["syndication.priority"] }],

  admin: {
    list: {
      // Scalar columns only. A group is several columns, and a collection is on
      // another table - naming either is a compile error as well as a runtime
      // one, because a list that loaded them would issue a query per row.
      columns: ["status", "updatedAt"],
    },
    form: {
      // The form *does* carry them: this is the surface where a group renders as
      // a section and a collection as an editor.
      fields: ["categories", "relatedArticles", "syndication", "faq"],
    },
  },
});
