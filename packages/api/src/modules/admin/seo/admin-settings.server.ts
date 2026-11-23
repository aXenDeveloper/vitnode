import type { Context } from "hono";

import {
  getSitemapSources,
  robotsContext,
  seoSiteOrigin,
  sitemapSourceStats,
} from "@/lib/seo/serve.server";
import { loadSeoSettings } from "@/lib/seo/settings.server";

import type { SeoAdminSettings } from "./seo.schema";

/** The settings with every source's size, for the AdminCP. Server-only. */
export const readSeoAdminSettings = async (
  c: Context,
): Promise<SeoAdminSettings> => {
  const settings = await loadSeoSettings(c);
  const disabled = new Set(settings.sitemap.disabledSources);
  const [context, sources] = await Promise.all([
    robotsContext(c),
    Promise.all(
      getSitemapSources(c).map(async source => ({
        contentType: source.contentType ?? null,
        enabled: !disabled.has(source.id),
        id: source.id,
        label: source.label,
        ...(await sitemapSourceStats(
          c,
          source,
          settings.sitemap.maxUrlsPerFile,
        )),
      })),
    ),
  ]);

  return {
    robots: {
      disallow: context.disallow,
      offline: context.offline,
      sitemapUrl: context.sitemapUrl,
    },
    settings,
    siteOrigin: seoSiteOrigin(),
    sources,
  };
};
