import { blogPlugin } from '@vitnode/blog/config'
import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { buildConfig } from '@vitnode/core/vitnode.config'
import { examplePlugin } from '@vitnode/example/config'
import { forumPlugin } from '@vitnode/forum/config'
import {
  BookOpenIcon,
  CompassIcon,
  ListIcon,
  MessagesSquareIcon,
  PuzzleIcon,
  SearchIcon,
} from 'lucide-react'

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
  logo: LogoVitNodeBrand,
  metadata: {
    shortTitle: 'VitNode',
    title: 'VitNode',
  },
  navigation: {
    header: [
      { href: '/docs', icon: BookOpenIcon, title: 'site.menu.docs' },
      { href: '/plugins', icon: PuzzleIcon, title: 'site.menu.plugins' },
      {
        href: '/forum',
        icon: MessagesSquareIcon,
        items: [
          {
            description: 'site.menu.discover_description',
            href: '/discover',
            icon: CompassIcon,
            title: 'site.menu.discover',
          },
          {
            description: 'site.menu.browse_description',
            href: '/example/browse',
            icon: ListIcon,
            title: 'site.menu.browse',
          },
        ],
        title: 'site.menu.community',
      },
    ],
    mobileBottomBar: [
      { href: '/forum', icon: MessagesSquareIcon, title: 'site.menu.forum' },
      { href: '/discover', icon: CompassIcon, title: 'site.menu.discover' },
      { href: '/search', icon: SearchIcon, title: 'site.menu.search' },
    ],
  },
  plugins: [blogPlugin(), examplePlugin(), forumPlugin()],
  theme: {
    defaultTheme: 'system',
  },
})

export type Locale = (typeof vitNodeConfig.i18n.locales)[number]['code']
