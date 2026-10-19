import { localeAlternateLinks, pageHead } from '@vitnode/core/tanstack/metadata'

import { HOME_DESCRIPTION, HOME_TITLE } from '@/site/home/metadata'

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
  compare: {
    breadcrumbs: [{ name: 'Compare', path: '/compare' }],
    description:
      'VitNode compared with Invision Community, XenForo, Discourse, Flarum, NodeBB and WordPress with bbPress: licence, pricing, moderation, translations, AI and APIs, with sources.',
    path: '/compare',
    title: 'Compare - VitNode vs Invision, XenForo, Discourse and More',
  },
  extensions: {
    breadcrumbs: [{ name: 'Extension directory', path: '/extensions' }],
    description:
      'Every official VitNode plugin, adapter and tool: blog, forum, Elasticsearch, S3 and R2, Supabase Storage, Resend, Nodemailer and more, with install commands.',
    path: '/extensions',
    title: 'Extension Directory - Official Plugins and Adapters',
  },
  home: { description: HOME_DESCRIPTION, path: '/', title: HOME_TITLE },
  integrations: {
    breadcrumbs: [{ name: 'Integrations', path: '/integrations' }],
    description:
      'VitNode integrations for search, file storage, email, sign-in, captcha, AI models, background jobs and hosting, each linked to its setup guide.',
    path: '/integrations',
    title: 'Integrations - Search, Storage, Email, Sign-in and AI',
  },
  platform: {
    breadcrumbs: [{ name: 'Platform', path: '/platform' }],
    description:
      'What every VitNode site starts with: the core, the AdminCP and the security layers, plus the reasons teams pick an open-source community platform.',
    path: '/platform',
    title: 'Platform - Core, AdminCP and Security',
  },
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
  whyVitnode: {
    breadcrumbs: [{ name: 'Why VitNode', path: '/why-vitnode' }],
    description:
      'Why VitNode: a forum, a blog, members, moderation and an AdminCP on one open-source TypeScript core you host, and an honest list of what is still to come.',
    path: '/why-vitnode',
    title: 'Why VitNode - One Open-Source Home for Your Community',
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
  extraNodes: readonly object[],
  language: string,
) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@id': `${SITE_ORIGIN}/#website`,
      '@type': 'WebSite',
      inLanguage: language,
      name: 'VitNode',
      url: `${SITE_ORIGIN}/`,
    },
    {
      '@id': `${url}#webpage`,
      '@type': 'WebPage',
      about: { '@id': softwareNode['@id'] },
      description: page.description,
      inLanguage: language,
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
    ...extraNodes,
  ],
})

const OG_LOCALES: Readonly<Record<string, string>> = {
  en: 'en_US',
  pl: 'pl_PL',
}

export interface MarketingHeadOptions {
  extraNodes?: readonly object[]
  locale?: string
}

export const marketingHead = (
  page: MarketingPageMeta,
  { extraNodes = [], locale }: MarketingHeadOptions = {},
) => {
  const { description, path, title } = page
  const alternates = locale
    ? localeAlternateLinks({ internalPathname: path, locale })
    : []
  const url =
    alternates.find(({ rel }) => rel === 'canonical')?.href ??
    new URL(path, SITE_ORIGIN).href
  const language = locale ?? 'en'
  const socialTitle = `${title} - VitNode`
  const head = pageHead({
    description,
    openGraph: { description, title: socialTitle, type: 'website' },
    robots: 'index, follow',
    title,
  })

  return {
    links:
      alternates.length > 0 ? alternates : [{ href: url, rel: 'canonical' }],
    meta: [
      ...head.meta,
      { content: BRAND_BLUE, name: 'theme-color' },
      { content: url, property: 'og:url' },
      { content: 'VitNode', property: 'og:site_name' },
      { content: OG_LOCALES[language] ?? 'en_US', property: 'og:locale' },
      { content: 'summary_large_image', name: 'twitter:card' },
      { content: socialTitle, name: 'twitter:title' },
      { content: description, name: 'twitter:description' },
    ],
    scripts: [
      {
        children: JSON.stringify(
          structuredData(page, url, extraNodes, language),
        ).replaceAll('<', '\\u003c'),
        type: 'application/ld+json',
      },
    ],
  }
}
