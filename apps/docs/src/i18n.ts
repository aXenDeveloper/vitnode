import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * Shared by `vitnode.config.ts` (web) and `vitnode.api.config.ts` (API) so the
 * site and its emails agree on which languages exist.
 *
 * Packages ship their own languages - only what this app adds or reworks needs
 * a file here. Anything a file leaves out falls back to `defaultLocale`.
 *
 * There is deliberately no `@vitnode/core` entry. VitNode's own Polish now ships
 * with the package (`packages/vitnode/src/locales/pl.json` for the frontend,
 * `locales/api/pl.json` for the emails), so this app reads the same translation
 * every install gets. It used to carry a copy, and a copy is exactly how one
 * product came to say both "Bezpieczeństwo" and "Zabezpieczenia" for the same
 * settings tab, depending on which frontend rendered it.
 */
export const i18n = {
  defaultLocale: "en",
  locales: [
    {
      code: "en",
      name: "English",
    },
    {
      code: "pl",
      name: "Polski",
    },
  ],
  messages: {
    pl: {
      "@vitnode/blog": async () =>
        await import("./locales/@vitnode/blog/pl.json"),
    },
  },
} satisfies VitNodeI18nConfig;
