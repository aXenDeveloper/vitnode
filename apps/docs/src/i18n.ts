import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * Shared by `vitnode.config.ts` (web) and `vitnode.api.config.ts` (API) so the
 * site and its emails agree on which languages exist.
 *
 * Packages ship their own languages - only what this app adds or reworks needs
 * a file here. Anything a file leaves out falls back to `defaultLocale`.
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
      "@vitnode/core": async () =>
        await import("./locales/@vitnode/core/pl.json"),
    },
  },
} satisfies VitNodeI18nConfig;
