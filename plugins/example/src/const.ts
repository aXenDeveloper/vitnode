export const CONFIG_PLUGIN = { pluginId: "@vitnode/example" as const };

export const EXAMPLE_MIGRATIONS = [
  "add_example_content",
  "add_publication_to_example_articles",
  "add_example_article_slug",
  // Core, not `example_*`, but the editorial suites write revisions for an
  // article - so the table has to exist before the column that needs it.
  "add_content_revisions",
  "add_example_article_editorial",
  // Core again, for the same reason: the scheduling suites book a publication
  // for an article, and the row has to have somewhere to go.
  "add_content_schedules",
  "add_content_schedule_effects_error",
  // The Stage 5A localized fixture: a base table with only its shared field, and
  // a translation table holding the localized ones.
  "add_example_localized_articles",
  // Stage 5B. Additive only: `languageId` arrives nullable, so every existing
  // revision is a shared one, and the translation lifecycle columns arrive with
  // `DEFAULT 'draft'`, so every translation written while Stage 5A was current
  // becomes a draft rather than being silently published.
  "add_translation_editorial",
  // Stage 6: the advanced-modeling fixture. One base table with a flattened
  // shared group, one translation table with a flattened localized group, two
  // junction tables (one of them a self-relation) and one repeatable child
  // table - each with the constraints that make its ordering and its integrity
  // facts about the database rather than about the service.
  "add_example_advanced_articles",
  // Stage 8. Core again: `core_content_slug_history` is what makes an old public
  // URL keep working, and the delivery suites write reservations for both example
  // content types - so the table has to exist before either of them publishes.
  "add_content_slug_history",
  // The shared boolean `delivery.seo.noIndexField` reads, which drives the sitemap
  // exclusion and the `robots` metadata together. Additive and defaulted, so every
  // existing row becomes indexable rather than silently disappearing from a sitemap.
  "add_example_article_no_index",
  // The same field on `example.article`, but **nullable** - the shape an upgrade
  // actually produces. `NULL` has to mean "indexable" identically in the metadata
  // and in the sitemap predicate, and only a nullable column can prove it.
  "add_example_article_no_index_flag",
  // File fields: `example_articles.animation`, an integer foreign key into
  // `core_files` with `ON DELETE RESTRICT`. Core arrives with it -
  // `core_content_file_refs` is what pins the files a retained revision names -
  // so the shared table has to exist before anything can reference it.
  "add_content_file_fields",
];
