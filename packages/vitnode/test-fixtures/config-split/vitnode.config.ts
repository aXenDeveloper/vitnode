import { buildConfig } from "../../src/vitnode.config";


export const vitNodeConfig = buildConfig({
  i18n: {
    defaultLocale: "en",
    locales: [
      { code: "en", name: "English" },
      { code: "pl", name: "Polski" },
    ],
    timeZone: "UTC",
  },
  metadata: { shortTitle: "Fixture", title: "Fixture" },
  plugins: [
    {
      localeFiles: {
        en: "@acme/blog/locales/en.json",
        pl: "@acme/blog/locales/pl.json",
      },
      pluginId: "@acme/blog",
    },
    { pluginId: "@acme/docs" },
  ],
});
