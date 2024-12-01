import type { MetadataRoute } from 'next';

import { rootSitemap } from 'vitnode-frontend/sitemap';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemap = await rootSitemap();

  return sitemap;
}
