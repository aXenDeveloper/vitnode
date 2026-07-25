import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * Shared by `vitnode.config.ts` (web) and `vitnode.api.config.ts` (API) so the
 * site and its emails agree on which languages exist. Packages ship their own
 * languages - only what this app adds or reworks needs a file here.
 */
export const i18n = {
  defaultLocale: "en",
  locales: [],
  messages: {},
} satisfies VitNodeI18nConfig;
