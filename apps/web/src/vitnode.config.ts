import { getRequestConfig } from 'next-intl/server';
import { getVitNodeConfig } from 'vitnode/vitnode.config';

export const vitNodeConfig = getVitNodeConfig({
  metadata: {
    title: 'VitNode',
    shortTitle: 'VitNode',
  },
  plugins: [],
  i18n: {
    locales: ['en', 'pl'] as const,
    defaultLocale: 'en',
  },
  debug: true,
});

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? vitNodeConfig.i18n.defaultLocale;

  return {
    locale,
    messages: (await import(`@/plugins/core/langs/${locale}.json`)).default,
  };
});
