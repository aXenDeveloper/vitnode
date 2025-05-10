import { getRequestConfig } from 'next-intl/server';
import { blogPlugin } from 'vitnode-blog/plugin.config';
import { buildConfig, handleRequestConfig } from 'vitnode/vitnode.config';

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

// This is the request config for the app. It will be used in the app router.
export default getRequestConfig(({ requestLocale }) =>
  handleRequestConfig({ requestLocale, vitNodeConfig }),
);
