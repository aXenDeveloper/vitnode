import type { VitNodeI18nConfig } from "@vitnode/core/lib/i18n/types";

export const i18n = {
  defaultLocale: "en",
  /**
   * Explicit, because this API renders emails on a server: without one, dates
   * format in whatever zone the host happens to run in.
   */
  timeZone: "UTC",
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
  messages: {},
} satisfies VitNodeI18nConfig;
