import type { QueryClient } from '@tanstack/react-query'
import type { AbstractIntlMessages } from 'use-intl'

import { intlQueryOptions } from '@vitnode/core/tanstack/i18n'
import { pageHead } from '@vitnode/core/tanstack/metadata'

import { HOME_DESCRIPTION, HOME_TITLE } from '@/site/home/metadata'
import { vitNodeConfig } from '@/vitnode.config'

import {
  AUTHOR_NAME,
  AUTHOR_URL,
  LICENSE_URL,
  REPOSITORY_URL,
  SITE_ORIGIN,
} from './links'

const BRAND_BLUE = '#3261bf'

export interface MarketingCrumb {
  name: string
  path: string
}

export interface MarketingPageMeta {
  breadcrumbs?: MarketingCrumb[]
  description: string
  path: string
  title: string
}

export interface MarketingPageText {
  description: string
  locale: string
  title: string
}

const MARKETING_META_NAMESPACE = 'site.meta'

type TranslatedMarketingPage = 'home' | 'plugins' | 'solutions'

const messageAt = (
  messages: AbstractIntlMessages,
  path: readonly string[],
): string | undefined => {
  let node: AbstractIntlMessages | string | undefined = messages
  for (const segment of path) {
    if (typeof node !== 'object') return undefined
    node = node[segment]
  }

  return typeof node === 'string' ? node : undefined
}

export const loadMarketingPageText = async (
  { locale, queryClient }: { locale: string; queryClient: QueryClient },
  page: TranslatedMarketingPage,
): Promise<MarketingPageText> => {
  const { messages } = await queryClient.query({
    ...intlQueryOptions({ locale, namespaces: [MARKETING_META_NAMESPACE] }),
    staleTime: 'static',
  })
  const pagePath = [...MARKETING_META_NAMESPACE.split('.'), page]
  const fallback = MARKETING_PAGES[page]

  return {
    description:
      messageAt(messages, [...pagePath, 'description']) ?? fallback.description,
    locale,
    title: messageAt(messages, [...pagePath, 'title']) ?? fallback.title,
  }
}

const everyLocale = (path: string) =>
  Object.fromEntries(vitNodeConfig.i18n.locales.map(({ code }) => [code, path]))

export const MARKETING_PAGES = {
  home: { description: HOME_DESCRIPTION, path: '/', title: HOME_TITLE },
  plugins: {
    breadcrumbs: [{ name: 'Plugins', path: '/plugins' }],
    description:
      'Every VitNode feature ships as a plugin. Meet the blog plugin, the example plugin for learning, and see what a plugin of your own looks like.',
    path: '/plugins',
    title: 'Plugins - The Blog, the Example and Features of Your Own',
  },
  solutions: {
    breadcrumbs: [{ name: 'Solutions', path: '/solutions' }],
    description:
      'Five sites built with VitNode: a help center, a membership site, an open-source hub, a gaming guild hub and a multilingual magazine, with roles and screens.',
    path: '/solutions',
    title: 'Solutions - Five Sites Built with VitNode',
  },
} satisfies Record<string, MarketingPageMeta>

const softwareNode = {
  '@id': `${SITE_ORIGIN}/#software`,
  '@type': 'SoftwareSourceCode',
  author: { '@type': 'Person', name: AUTHOR_NAME, url: AUTHOR_URL },
  codeRepository: REPOSITORY_URL,
  description: HOME_DESCRIPTION,
  isAccessibleForFree: true,
  license: LICENSE_URL,
  name: 'VitNode',
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'Node.js',
  version: '2.0 canary',
}

const breadcrumbNode = (crumbs: MarketingCrumb[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', item: `${SITE_ORIGIN}/`, name: 'Home', position: 1 },
    ...crumbs.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      item: new URL(path, SITE_ORIGIN).href,
      name,
      position: index + 2,
    })),
  ],
})

const structuredData = (
  page: MarketingPageMeta,
  url: string,
  locale: string,
) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@id': `${SITE_ORIGIN}/#website`,
      '@type': 'WebSite',
      inLanguage: 'en',
      name: 'VitNode',
      url: `${SITE_ORIGIN}/`,
    },
    {
      '@id': `${url}#webpage`,
      '@type': 'WebPage',
      about: { '@id': softwareNode['@id'] },
      description: page.description,
      inLanguage: locale,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      name: `${page.title} - VitNode`,
      url,
    },
    softwareNode,
    ...(page.path === '/'
      ? [
          {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            itemOffered: { '@id': softwareNode['@id'] },
            price: '0',
            priceCurrency: 'USD',
            url,
          },
        ]
      : []),
    ...(page.breadcrumbs ? [breadcrumbNode(page.breadcrumbs)] : []),
  ],
})

export const marketingHead = (
  page: MarketingPageMeta,
  text: Partial<MarketingPageText> = {},
) => {
  const description = text.description ?? page.description
  const title = text.title ?? page.title
  const locale = text.locale ?? vitNodeConfig.i18n.defaultLocale
  const socialTitle = `${title} - VitNode`
  const head = pageHead({
    alternates: everyLocale(page.path),
    description,
    locale,
    openGraph: { description, title: socialTitle, type: 'website' },
    robots: 'index, follow',
    title,
  })
  const url =
    head.links?.find(({ rel }) => rel === 'canonical')?.href ??
    new URL(page.path, SITE_ORIGIN).href

  return {
    links: head.links ?? [],
    meta: [...head.meta, { content: BRAND_BLUE, name: 'theme-color' }],
    scripts: [
      {
        children: JSON.stringify(
          structuredData({ ...page, description, title }, url, locale),
        ).replaceAll('<', '\\u003c'),
        type: 'application/ld+json',
      },
    ],
  }
}
