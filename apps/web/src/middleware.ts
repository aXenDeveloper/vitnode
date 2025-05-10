import createMiddleware from 'next-intl/middleware';

import { vitNodeConfig } from './vitnode.config';

export default createMiddleware({
  locales: vitNodeConfig.i18n.locales,
  defaultLocale: vitNodeConfig.i18n.defaultLocale,
  localePrefix: vitNodeConfig.i18n.localePrefix,
});

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Set a cookie to remember the previous locale for
    // all requests that have a locale prefix
    '/(pl|en)/:path*',

    // Enable redirects that add missing locales
    // (e.g. `/pathnames` -> `/en/pathnames`)
    '/((?!_next|_vercel|api|.*\\..*).*)',
  ],
};
