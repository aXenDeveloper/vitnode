"use client";

/**
 * `use-intl`'s provider, handed out from inside `@vitnode/core`.
 *
 * Two lines, and the reason for them is module identity rather than behaviour.
 * Every shared component in this package reads its strings through
 * `useTranslations` from `use-intl`, which is a React context - and a React
 * context belongs to the *module record* it was created in, not to the package
 * name. An app that mounts its own `use-intl` provider is only providing into
 * core's context while both sides happen to have loaded the same record.
 *
 * They do not always. In `apps/web`, `@vitnode/core` is external to Vite's SSR
 * pass and so is loaded by Node, while the app's own source goes through Vite's
 * module runner - two records, two contexts, and every core component that
 * translates throws "No intl context found" under `vite dev` while a production
 * build (which merges them into one chunk) stays green.
 *
 * Importing the provider from here removes the coincidence: it is loaded by
 * whatever loaded this package, which is by definition the record core's own
 * components read. An app that wants to scope messages to a route mounts this
 * one - alongside its own, if its own code translates too.
 *
 * Framework-free on purpose: no `next-intl`, so a TanStack Start route can use
 * it. Next.js apps have `I18nProvider` (`@/components/i18n-provider`), which
 * reads the request scope and is Next-only by design.
 */
export { IntlProvider } from "use-intl";
