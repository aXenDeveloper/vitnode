import { blogPlugin } from '@vitnode/blog/config'
import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { buildConfig } from '@vitnode/core/vitnode.config'
import { examplePlugin } from '@vitnode/example/config'
import { forumPlugin } from '@vitnode/forum/config'
import {
  AppWindowIcon,
  BookOpenIcon,
  BoxIcon,
  BracesIcon,
  CompassIcon,
  CrownIcon,
  GitBranchIcon,
  GitPullRequestIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  ListIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  PackageIcon,
  PlugIcon,
  PuzzleIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  UsersIcon,
} from 'lucide-react'

import { REPOSITORY_URL } from './site/marketing/links'

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
      {
        href: '/why-vitnode',
        items: [
          {
            description: 'site.menu.why_description',
            href: '/why-vitnode',
            icon: LightbulbIcon,
            title: 'site.menu.why',
          },
          {
            description: 'site.menu.core_description',
            href: '/platform/core',
            icon: BoxIcon,
            title: 'site.menu.core',
          },
          {
            description: 'site.menu.admincp_description',
            href: '/platform/admincp',
            icon: LayoutDashboardIcon,
            title: 'site.menu.admincp',
          },
          {
            description: 'site.menu.security_description',
            href: '/platform/security',
            icon: ShieldCheckIcon,
            title: 'site.menu.security',
          },
        ],
        title: 'site.menu.explore',
      },
      {
        href: '/solutions',
        items: [
          {
            description: 'site.menu.blogs_description',
            href: '/solutions/blog',
            icon: NewspaperIcon,
            title: 'site.menu.blogs',
          },
          {
            description: 'site.menu.forums_description',
            href: '/solutions/forum',
            icon: MessagesSquareIcon,
            title: 'site.menu.forums',
          },
          {
            description: 'site.menu.communities_description',
            href: '/solutions/community',
            icon: UsersIcon,
            title: 'site.menu.communities',
          },
          {
            description: 'site.menu.ecommerce_description',
            href: '/solutions/e-commerce',
            icon: ShoppingBagIcon,
            title: 'site.menu.ecommerce',
          },
          {
            description: 'site.menu.saas_description',
            href: '/solutions/saas',
            icon: AppWindowIcon,
            title: 'site.menu.saas',
          },
          {
            description: 'site.menu.memberships_description',
            href: '/solutions/membership-site',
            icon: CrownIcon,
            title: 'site.menu.memberships',
          },
        ],
        title: 'site.menu.build',
      },
      {
        href: '/plugins',
        items: [
          {
            description: 'site.menu.plugins_description',
            href: '/plugins',
            icon: PuzzleIcon,
            title: 'site.menu.plugins',
          },
          {
            description: 'site.menu.integrations_description',
            href: '/integrations',
            icon: PlugIcon,
            title: 'site.menu.integrations',
          },
          {
            description: 'site.menu.directory_description',
            href: '/extensions',
            icon: PackageIcon,
            title: 'site.menu.directory',
          },
        ],
        title: 'site.menu.extend',
      },
      {
        href: '/docs/dev',
        items: [
          {
            description: 'site.menu.documentation_description',
            href: '/docs/dev',
            icon: BookOpenIcon,
            title: 'site.menu.documentation',
          },
          {
            description: 'site.menu.architecture_description',
            href: '/docs/dev/architecture',
            icon: LayersIcon,
            title: 'site.menu.architecture',
          },
          {
            description: 'site.menu.api_description',
            href: '/docs/dev/plugins/api/modules',
            icon: BracesIcon,
            title: 'site.menu.api',
          },
          {
            description: 'site.menu.contributing_description',
            href: '/docs/dev/contribution',
            icon: GitPullRequestIcon,
            title: 'site.menu.contributing',
          },
          {
            description: 'site.menu.github_description',
            href: REPOSITORY_URL,
            icon: GitBranchIcon,
            isOpenInNewTab: true,
            title: 'site.menu.github',
          },
        ],
        title: 'site.menu.developers',
      },
      {
        href: '/forum',
        items: [
          {
            description: 'site.menu.forum_description',
            href: '/forum',
            icon: MessagesSquareIcon,
            title: 'site.menu.forum',
          },
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
