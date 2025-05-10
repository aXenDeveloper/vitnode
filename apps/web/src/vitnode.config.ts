import { getRequestConfig } from 'next-intl/server';
import { blogPlugin } from 'vitnode-blog/plugin.config';
import { buildConfig } from 'vitnode/vitnode.config';

export const vitNodeConfig = buildConfig({
  metadata: {
    title: 'VitNode',
    shortTitle: 'VitNode',
  },
  plugins: [blogPlugin()],
  i18n: {
    locales: ['en', 'pl'] as const,
    defaultLocale: 'en',
  },
  debug: true,
  theme: {
    defaultTheme: 'dark',
  },
});

export default getRequestConfig(async ({ requestLocale }) => {
  const reqLocale = await requestLocale;
  const locale =
    reqLocale && `${vitNodeConfig.i18n.locales}`.includes(reqLocale)
      ? reqLocale
      : vitNodeConfig.i18n.defaultLocale;

  return {
    locale,
    messages: (await import(`@/plugins/core/langs/${locale}.json`)).default,
  };
});
