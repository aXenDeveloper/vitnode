import { pageHead } from '#/lib/page-head'
import { HOME_DESCRIPTION, HOME_TITLE } from '#/site/home/metadata'

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
      'Five solutions built with VitNode: a help center, a membership site, an open-source project hub, a gaming guild hub and a multilingual magazine, each with the flow, the roles and real screens.',
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

const structuredData = (page: MarketingPageMeta, url: string) => ({
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
      inLanguage: 'en',
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
            url: `${url}#pricing`,
          },
        ]
      : []),
    ...(page.breadcrumbs ? [breadcrumbNode(page.breadcrumbs)] : []),
  ],
})

export const marketingHead = (page: MarketingPageMeta) => {
  const { description, path, title } = page
  const url = new URL(path, SITE_ORIGIN).href
  const socialTitle = `${title} - VitNode`
  const head = pageHead({
    description,
    openGraph: { description, title: socialTitle, type: 'website' },
    robots: 'index, follow',
    title,
  })

  return {
    links: [{ href: url, rel: 'canonical' }],
    meta: [
      ...head.meta,
      { content: BRAND_BLUE, name: 'theme-color' },
      { content: url, property: 'og:url' },
      { content: 'VitNode', property: 'og:site_name' },
      { content: 'en_US', property: 'og:locale' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: socialTitle, name: 'twitter:title' },
      { content: description, name: 'twitter:description' },
    ],
    scripts: [
      {
        children: JSON.stringify(structuredData(page, url)).replaceAll(
          '<',
          '\\u003c',
        ),
        type: 'application/ld+json',
      },
    ],
  }
}
