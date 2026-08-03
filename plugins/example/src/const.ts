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
];
