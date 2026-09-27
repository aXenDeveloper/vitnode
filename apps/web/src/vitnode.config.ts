import { blogPlugin } from '@vitnode/blog/config'
import { buildConfig } from '@vitnode/core/vitnode.config'
import { examplePlugin } from '@vitnode/example/config'

export const vitNodeConfig = buildConfig({
  debug: false,
  editor: {
    emojis: [
      {
        emojis: [
          {
            name: 'vitnode',
            src: '/logo_vitnode_icon.svg',
            tags: ['logo', 'brand'],
          },
        ],
        label: 'VitNode',
      },
    ],
  },
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'pl', name: 'Polski' },
    ],
    routePaths: {
      pl: {
        '/blog/:slug': '/wpisy/:slug',
        '/discover': '/odkrywaj',
        '/search': '/szukaj',
        '/users/:nameCode': '/uzytkownicy/:nameCode',
      },
    },
    timeZone: 'UTC',
  },
  metadata: {
    shortTitle: 'VitNode',
    title: 'VitNode',
  },
  plugins: [blogPlugin(), examplePlugin()],
  theme: {
    defaultTheme: 'system',
  },
})

export type Locale = (typeof vitNodeConfig.i18n.locales)[number]['code']
