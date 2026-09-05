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
  plugins: [{ pluginId: "@acme/blog" }, { pluginId: "@acme/docs" }],
});
