import { CONFIG } from '@vitnode/api/lib/config'

import type { DocsPageData } from './transport'

const absolute = (path: string) => new URL(path, CONFIG.web).href

const escapeForScriptTag = (json: string) =>
  json.replaceAll('<', String.raw`\u003c`)

export const docsStructuredDataScript = ({
  breadcrumbs,
  description,
  section,
  title,
  url,
}: DocsPageData) => ({
  children: escapeForScriptTag(
    JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TechArticle',
          articleSection: section?.title,
          description,
          headline: title,
          inLanguage: 'en',
          isPartOf: {
            '@type': 'WebSite',
            name: 'VitNode',
            url: absolute('/'),
          },
          mainEntityOfPage: absolute(url),
          publisher: {
            '@type': 'Organization',
            logo: absolute('/icon-512.png'),
            name: 'VitNode',
          },
          url: absolute(url),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            item: crumb.url ? absolute(crumb.url) : undefined,
            name: crumb.name,
            position: index + 1,
          })),
        },
      ],
    }),
  ),
  type: 'application/ld+json',
})
