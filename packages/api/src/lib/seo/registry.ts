import type { SitemapSource } from "./sitemap";

import { defineSitemapSource } from "./sitemap";

const registered = new Map<string, SitemapSource>();

/**
 * Adds a sitemap source at runtime, next to those declared with
 * `buildApiPlugin({ sitemapSources })` and `buildApiConfig({ seo })`.
 * Registering the same id again replaces the earlier source, so a reloaded
 * module does not throw. Declared sources win over registered ones with the
 * same id. Server-only.
 *
 * @throws When `source.id` does not match `/^[a-z0-9_-]+$/`.
 *
 * @example
 * import { registerSitemapSource } from "@vitnode/api/lib/seo/registry";
 *
 * registerSitemapSource({
 *   id: "landing",
 *   label: "Landing pages",
 *   count: async () => 2,
 *   getEntries: async () => [{ loc: "/pricing" }, { loc: "/about" }],
 * });
 */
export const registerSitemapSource = (source: SitemapSource): void => {
  registered.set(source.id, defineSitemapSource(source));
};

/** Every source added with {@link registerSitemapSource}, in registration order. */
export const registeredSitemapSources = (): SitemapSource[] => [
  ...registered.values(),
];
