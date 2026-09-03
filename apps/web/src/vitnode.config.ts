import { blogPlugin } from '@vitnode/blog/config'
import { buildConfig } from '@vitnode/core/vitnode.config'
import { examplePlugin } from '@vitnode/example/config'

export const vitNodeConfig = buildConfig({
  debug: false,
  i18n: {
    defaultLocale: 'en',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'pl', name: 'Polski' },
    ],
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
