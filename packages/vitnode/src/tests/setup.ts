import type * as UseIntl from "use-intl";

import { vi } from "vitest";

vi.mock("use-intl", async importOriginal => {
  const actual = await importOriginal<typeof UseIntl>();

  const useTranslations = (namespace?: string) => {
    const translate = (key: string) =>
      namespace ? `${namespace}.${key}` : key;
    translate.has = () => false;
    translate.rich = translate;
    translate.markup = translate;
    translate.raw = translate;

    return translate;
  };

  return {
    ...actual,
    useLocale: () => "en",
    useTranslations,
  };
});
