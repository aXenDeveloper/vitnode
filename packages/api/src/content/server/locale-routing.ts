import type { Context } from "hono";

import type { LocaleRouting } from "../../lib/i18n/locale-routing";

import { createLocaleRouting } from "../../lib/i18n/locale-routing";

const UNCONFIGURED_LOCALE_ROUTING: LocaleRouting = createLocaleRouting({
  defaultLocale: "en",
  locales: ["en"],
});

export const contentLocaleRouting = (c: Context): LocaleRouting =>
  c.get("core")?.i18n?.localeRouting ?? UNCONFIGURED_LOCALE_ROUTING;
