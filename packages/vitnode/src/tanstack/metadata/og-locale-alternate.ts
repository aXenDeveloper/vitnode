export const OG_LOCALE_ALTERNATE_NAME_PREFIX = "vitnode:og:locale:alternate:";

export const isOgLocaleAlternateName = (name: unknown): boolean =>
  typeof name === "string" && name.startsWith(OG_LOCALE_ALTERNATE_NAME_PREFIX);
