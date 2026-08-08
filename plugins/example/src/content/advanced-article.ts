import { defineContentType, field } from "@vitnode/core/content";

import { categoryContentType } from "./category";

/**
 * The Stage 6 reference: every advanced modeling shape on one content type.
 *
 * - **`categories`** - an unordered to-many relation. Its values live in
 *   `example_advanced_articles_categories`, a junction table with a real
 *   foreign key at each end; `onDelete: "restrict"` means Postgres itself
 *   refuses to delete a category that is still in use, rather than a check in
 *   service code that a direct `DELETE` would walk past.
 * - **`relatedArticles`** - an **ordered self-relation**, declared with
 *   `self: true` rather than `target: () => advancedArticleContentType`. The
 *   difference is not stylistic: a definition whose field map mentions its own
 *   inferred type is circular, and TypeScript resolves that by widening the
 *   whole definition to `any` - silently taking every nested value type with
 *   it. `ordered: true` keeps the author's order, and `UNIQUE (itemId,
 *   position)` is what makes that order a fact rather than a hope.
 * - **`seo`** - a **localized** group. Its leaves are stored as `seoTitle` and
 *   `seoDescription` on the *translation* table, so every language gets its own
 *   SEO copy - and the value stays nested (`row.seo.title`) whatever the columns
 *   are called.
 * - **`syndication`** - a **shared** group. Same mechanics, on the base table.
 *   Kept separate from `seo` on purpose: localization is a property of the whole
 *   group, so a group cannot have one localized leaf and one shared one. Two
 *   groups is the shape that says which is which.
 * - **`faq`** - a repeatable. Its children live in
 *   `example_advanced_articles_faq`, each with a `serial` primary key of its own
 *   so identity survives a reorder, and `search.contentFields` indexes their
 *   prose in position order.
 *
 * What is deliberately **not** here is the combination Stage 6 refuses:
 * `field.repeatable({ localized: true })`, and a `localized: true` leaf inside
 * either kind. See `apps/docs/content/docs/dev/content-engine/advanced-modeling-limitations.mdx`.
 */
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

  /**
   * Leaf-level allowlisting.
   *
   * `seo.title` and `seo.description` are public; `syndication.priority` is
   * public and `syndication.indexable` is **not**, which is the whole point of
   * naming leaves rather than groups: exposing one leaf must not expose its
   * neighbours, and a leaf added later stays private until somebody says
   * otherwise.
   *
   * `categories` is exposed as identifiers. Not as expanded rows: a category has
   * its own public API, its own allowlist and its own publication state, and
   * publishing another content type's data because two records are related is
   * not a decision this allowlist gets to make. `relatedArticles` is private
   * altogether.
   */
  publicApi: {
    enabled: true,
    path: "advanced-articles",
    fields: [
      "title",
      "slug",
      "categories",
      "seo.title",
      "seo.description",
      "syndication.priority",
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

  /**
   * A document per published translation, built from three kinds of value at
   * once: a plain localized field, a localized group leaf, and a repeatable's
   * children joined in position order.
   */
  search: {
    enabled: true,
    titleField: "title",
    descriptionField: "seo.description",
    contentFields: ["title", "seo.description", "faq.question", "faq.answer"],
    pathTemplate: "/{locale}/advanced-articles/{slug}",
  },

  // Leaf paths, materialised against the generated columns: this compiles to an
  // index on `syndicationPriority`, exactly as `{ on: ["priority"] }` would have
  // if `priority` were a top-level field.
  indexes: [{ on: ["syndication.priority"] }],

  admin: {
    label: {
      plural: "Example Advanced Articles",
      singular: "Example Advanced Article",
    },
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
