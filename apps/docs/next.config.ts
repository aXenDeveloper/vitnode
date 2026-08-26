import nextAnalyzer from "@next/bundle-analyzer";
import { vitNodeNextConfig } from "@vitnode/core/config/next.config";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

import { i18n } from "./src/i18n";

const withMDX = createMDX();

const withBundleAnalyzer = nextAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * `/docs` has no section of its own, so it forwards to the first one.
 *
 * Handled here rather than in the page: the page reads its slug inside a
 * `<Suspense>` boundary now, so a redirect decided there would stream after a
 * 200 instead of being a real HTTP redirect. `localePrefix` is `as-needed`, so
 * the default locale is unprefixed and every other locale gets its own entry.
 */
const docsIndexRedirects = [
  "",
  ...i18n.locales
    .filter(locale => locale.code !== i18n.defaultLocale)
    .map(locale => `/${locale.code}`),
].map(prefix => ({
  source: `${prefix}/docs`,
  destination: `${prefix}/docs/dev`,
  permanent: false,
}));

const nextConfig: NextConfig = {
  redirects: async () => docsIndexRedirects,
};

export default withBundleAnalyzer(withMDX(vitNodeNextConfig(nextConfig)));
