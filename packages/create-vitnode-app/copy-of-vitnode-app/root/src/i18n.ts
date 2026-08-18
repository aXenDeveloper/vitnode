import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

/**
 * Shared by `vitnode.config.ts` and `proxy.ts` so rendering and routing agree
 * on which languages exist.
 *
 * Kept apart from `vitnode.config.ts` on purpose: the Proxy runs outside the App
 * Directory and must not pull the request config - and with it
 * `next/root-params` - into its module graph.
 *
 * Packages ship their own languages - only what this app adds or reworks needs a
 * file here. Anything a file leaves out falls back to `defaultLocale`.
 */
export const i18n = {
  defaultLocale: "en",
  locales: [
    {
      code: "en",
      name: "English",
    },
  ],
} satisfies VitNodeI18nConfig;
