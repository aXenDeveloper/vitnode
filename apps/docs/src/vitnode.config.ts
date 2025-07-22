import { blogPlugin } from '@vitnode/blog/config';
import { buildConfig, handleRequestConfig } from '@vitnode/core/vitnode.config';
import { getRequestConfig } from 'next-intl/server';

export const vitNodeConfig = buildConfig({
  metadata: {
    title: 'VitNode',
    shortTitle: 'VitNode',
  },
  plugins: [blogPlugin()],
  debug: true,
  i18n: {
    locales: [
      {
        code: 'en',
        name: 'English',
      },
    ],
    defaultLocale: 'en',
  },
  theme: {
    defaultTheme: 'light',
  },
});

// This is the request config for the app. It will be used in the app router.
export default getRequestConfig(
  async ({ requestLocale }) =>
    await handleRequestConfig({
      requestLocale,
      vitNodeConfig,
      pathToMessages: async path => await import(`./locales/${path}`),
    }),
);
