import type { MetadataRoute } from 'next';

import { getMiddlewareData } from 'vitnode-frontend/api/get-middleware-data';
import { CONFIG } from 'vitnode-frontend/helpers/config-with-env';

import { getLegalData } from './views/theme/views/legal/legal-view';

export const rootSitemap = async (): Promise<MetadataRoute.Sitemap> => {
  const [{ languages, nav, languages_code_default, last_updated }, legal] =
    await Promise.all([getMiddlewareData(), getLegalData({})]);

  const navUrls: MetadataRoute.Sitemap = nav
    .filter(item => !item.external)
    .flatMap(item => {
      const urls: MetadataRoute.Sitemap = [
        {
          url: `${CONFIG.frontend_url}/${languages_code_default}${item.href.startsWith('/') ? item.href : `/${item.href}`}`,
          lastModified: item.last_updated,
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
            url: `${CONFIG.frontend_url}/${languages_code_default}${child.href.startsWith('/') ? child.href : `/${child.href}`}`,
            lastModified: child.last_updated,
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

  const legalUrls: MetadataRoute.Sitemap = legal.edges
    .filter(item => !item.href)
    .map(edge => ({
      url: `${CONFIG.frontend_url}/${languages_code_default}/legal/${edge.code}`,
      lastModified: edge.updated_at,
      changeFrequency: 'monthly',
      priority: 0.1,
      alternates: {
        languages: Object.fromEntries(
          languages.map(lang => [
            lang.code,
            `${CONFIG.frontend_url}/${lang.code}/legal/${edge.code}`,
          ]),
        ),
      },
    }));

  return [
    {
      url: `${CONFIG.frontend_url}/${languages_code_default}`,
      lastModified: last_updated,
      changeFrequency: 'yearly',
      priority: 1,
      alternates: {
        languages: Object.fromEntries(
          languages.map(lang => [
            lang.code,
            `${CONFIG.frontend_url}/${lang.code}`,
          ]),
        ),
      },
    },
    ...navUrls,
    {
      url: `${CONFIG.frontend_url}/${languages_code_default}/legal`,
      lastModified: legal.edges.length
        ? legal.edges[0].updated_at
        : last_updated,
      changeFrequency: 'yearly',
      priority: 0.2,
      alternates: {
        languages: Object.fromEntries(
          languages.map(lang => [
            lang.code,
            `${CONFIG.frontend_url}/${lang.code}/legal`,
          ]),
        ),
      },
    },
    ...legalUrls,
  ];
};
