import { z } from "zod";

import { zodSeoSettings } from "@/lib/seo/settings";

/** One sitemap source as the AdminCP lists it. Browser-safe. */
export const zodSeoAdminSitemapSource = z.object({
  id: z.string(),
  /** An i18n key, or plain text from a plugin. */
  label: z.string(),
  /** Set for Content Engine sources; the AdminCP names the content type. */
  contentType: z.object({ id: z.string(), pluginId: z.string() }).nullable(),
  enabled: z.boolean(),
  /** URLs the source lists right now. */
  urls: z.number().int(),
  /** Sub-sitemap files at the saved `maxUrlsPerFile`. */
  files: z.number().int(),
  /** The source failed to count; it is left out of the index. */
  error: z.boolean(),
});

/** What `GET /admin/seo/settings` answers. Browser-safe. */
export const zodSeoAdminSettings = z.object({
  settings: zodSeoSettings,
  sources: z.array(zodSeoAdminSitemapSource),
  /** What the AdminCP needs to preview `robots.txt` as the visitor gets it. */
  robots: z.object({
    disallow: z.array(z.string()),
    offline: z.boolean(),
    sitemapUrl: z.string(),
  }),
  siteOrigin: z.string(),
});

export type SeoAdminSettings = z.output<typeof zodSeoAdminSettings>;
export type SeoAdminSitemapSource = z.output<typeof zodSeoAdminSitemapSource>;
