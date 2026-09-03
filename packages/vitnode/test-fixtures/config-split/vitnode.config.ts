import { buildConfig } from "../../src/vitnode.config";

/**
 * A shared config exactly as an app writes one - the browser-safe half.
 *
 * Imports nothing but `buildConfig`, which is the whole claim under test: Vite
 * loads this file with `jiti` to discover the configured plugins, and the
 * document shell holds it in the browser bundle. `vitnode.server.config.ts`
 * beside it throws on import, so a discovery pass that reached the server half
 * would fail loudly instead of merely being slower than it should be.
 */
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
