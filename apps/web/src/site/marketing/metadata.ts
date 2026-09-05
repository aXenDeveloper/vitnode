import { pageHead } from '#/lib/page-head'
import { HOME_DESCRIPTION, HOME_TITLE } from '#/site/home/metadata'

import { REPOSITORY_URL } from './links'

export const SITE_ORIGIN = 'https://vitnode.com'

const pages = {
  home: { title: HOME_TITLE, description: HOME_DESCRIPTION, path: '/' },
  pricing: {
    title: 'Pricing — Free & Open Source',
    description:
      'VitNode is free, MIT-licensed community software. Get the full framework with no licence fees. See what is included and plan for your own hosting and services.',
    path: '/pricing',
  },
}

export const marketingHead = (page: keyof typeof pages) => {
  const { title, description, path } = pages[page]
  const url = new URL(path, SITE_ORIGIN).href
  const socialTitle = `${title} - VitNode`
  const head = pageHead({
    title,
    description,
    robots: 'index, follow',
    openGraph: { title: socialTitle, description, type: 'website' },
  })

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        name: 'VitNode',
        url: `${SITE_ORIGIN}/`,
        inLanguage: 'en',
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: socialTitle,
        description,
        inLanguage: 'en',
        isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
        about: { '@id': `${SITE_ORIGIN}/#software` },
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${SITE_ORIGIN}/#software`,
        name: 'VitNode',
        description: HOME_DESCRIPTION,
        codeRepository: REPOSITORY_URL,
        license: `${REPOSITORY_URL}/blob/canary/LICENSE`,
        programmingLanguage: 'TypeScript',
        version: '2.0 canary',
        isAccessibleForFree: true,
        author: {
          '@type': 'Person',
          name: 'Maciej Balcerzak',
          url: 'https://github.com/aXenDeveloper',
        },
      },
      ...(page === 'pricing'
        ? [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: `${SITE_ORIGIN}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Pricing',
                  item: url,
                },
              ],
            },
          ]
        : []),
    ],
  }

  return {
    ...head,
    links: [{ rel: 'canonical', href: url }],
    meta: [
      ...head.meta,
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'VitNode' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: socialTitle },
      { name: 'twitter:description', content: description },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
      },
    ],
  }
}
