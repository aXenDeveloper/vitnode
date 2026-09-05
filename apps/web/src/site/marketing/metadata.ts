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

const PAGES = {
  home: { description: HOME_DESCRIPTION, path: '/', title: HOME_TITLE },
  pricing: {
    description:
      'VitNode pricing is a very short conversation: the whole community framework is free and open source under the MIT licence. See what is included and what you still pay for.',
    path: '/pricing',
    title: 'Pricing - Free Forever, Open Source',
  },
} as const

type MarketingPage = keyof typeof PAGES

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

const breadcrumbNode = (name: string, url: string) => ({
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', item: `${SITE_ORIGIN}/`, name: 'Home', position: 1 },
    { '@type': 'ListItem', item: url, name, position: 2 },
  ],
})

const structuredData = (page: MarketingPage, url: string) => ({
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
      description: PAGES[page].description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      name: `${PAGES[page].title} - VitNode`,
      url,
    },
    softwareNode,
    ...(page === 'pricing'
      ? [
          {
            '@type': 'Offer',
            availability: 'https://schema.org/InStock',
            itemOffered: { '@id': softwareNode['@id'] },
            price: '0',
            priceCurrency: 'USD',
            url,
          },
          breadcrumbNode('Pricing', url),
        ]
      : []),
  ],
})

export const marketingHead = (page: MarketingPage) => {
  const { description, path, title } = PAGES[page]
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
