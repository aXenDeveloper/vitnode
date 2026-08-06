export const CONFIG_PLUGIN = { pluginId: "@vitnode/example" as const };

/**
 * Every committed migration in the docs app that touches `example_*`, in the
 * order the migrator applies them.
 *
 * The two database test suites both replay this list - one asserts the DDL as
 * text, the other runs it against a real Postgres - so a new migration only has
 * to be added here. It lives outside `src/database/` on purpose: Drizzle Kit
 * globs that folder and executes everything it finds.
 */
export const EXAMPLE_MIGRATIONS = [
  "0022_add_example_content.sql",
  "0023_add_publication_to_example_articles.sql",
  "0024_add_example_article_slug.sql",
  // Core, not `example_*`, but the editorial suites write revisions for an
  // article - so the table has to exist before the column that needs it.
  "0025_add_content_revisions.sql",
  "0026_add_example_article_editorial.sql",
  // Core again, for the same reason: the scheduling suites book a publication
  // for an article, and the row has to have somewhere to go.
  "0027_add_content_schedules.sql",
  "0028_add_content_schedule_effects_error.sql",
  // The Stage 5A localized fixture: a base table with only its shared field, and
  // a translation table holding the localized ones.
  "0029_add_example_localized_articles.sql",
  // Stage 5B. Additive only: `languageId` arrives nullable, so every existing
  // revision is a shared one, and the translation lifecycle columns arrive with
  // `DEFAULT 'draft'`, so every translation written while Stage 5A was current
  // becomes a draft rather than being silently published.
  "0030_add_translation_editorial.sql",
];
