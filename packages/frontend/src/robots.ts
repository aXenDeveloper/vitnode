import type { MetadataRoute } from 'next';

import { CONFIG } from './helpers/config-with-env';

// eslint-disable-next-line @typescript-eslint/require-await
export const rootRobots = async (): Promise<MetadataRoute.Robots> => {
  return {
    rules: {
      userAgent: '*',
      disallow: [
        '/admin',
        '/login',
        '/register',
        '/settings',
        '/search',
        '/api',
      ],
    },
    sitemap: `${CONFIG.frontend_url}/sitemap.xml`,
  };
};
