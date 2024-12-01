import type { MetadataRoute } from 'next';

import { getMiddlewareData } from 'vitnode-frontend/api/get-middleware-data';
import { CONFIG } from 'vitnode-frontend/helpers/config-with-env';
import { getLegalData } from './views/theme/views/legal/legal-view';

export const rootSitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const [{ languages, nav }, { edges }] = await Promise.all([
    getMiddlewareData(),
    getLegalData({}),
  ]);

  const navUrls: MetadataRoute.Sitemap = nav
    .filter(item => !item.external)
    .flatMap(item => {
      const urls: MetadataRoute.Sitemap = [
        {
          url: `${CONFIG.frontend_url}${item.href.startsWith('/') ? item.href : `/${item.href}`}`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.8,
          alternates: {
            languages: Object.fromEntries(
              languages.map(lang => [
                lang.code,
                `${CONFIG.frontend_url}/${lang.code}${item.href.startsWith('/') ? item.href : `/${item.href}`}`,
              ]),
            ),
          },
        },
      ];

      if (item.children) {
        item.children.forEach(child => {
          urls.push({
            url: `${CONFIG.frontend_url}${child.href.startsWith('/') ? child.href : `/${child.href}`}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
            alternates: {
              languages: Object.fromEntries(
                languages.map(lang => [
                  lang.code,
                  `${CONFIG.frontend_url}/${lang.code}${child.href.startsWith('/') ? child.href : `/${child.href}`}`,
                ]),
              ),
            },
          });
        });
      }

      return urls;
    });

  const legalUrls: MetadataRoute.Sitemap = edges
    .filter(item => !item.href)
    .map(edge => ({
      url: `${CONFIG.frontend_url}/legal/${edge.code}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.1,
    }));

  return [
    {
      url: CONFIG.frontend_url,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    ...navUrls,
    {
      url: `${CONFIG.frontend_url}/legal`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    ...legalUrls,
  ];
};
