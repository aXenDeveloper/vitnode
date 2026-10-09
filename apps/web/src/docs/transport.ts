import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb'
import { z } from 'zod'

import { docsGithubUrl, encodeMarkdownUrl } from './shared'
import { source } from './source.server'

const docsSlugSchema = z
  .string()
  .max(512)
  .transform((splat) => splat.split('/').filter(Boolean))

export const getDocsPage = createServerFn({ method: 'GET' })
  .validator(docsSlugSchema)
  .handler(({ data: slugs }) => {
    const page = source.getPage(slugs)

    // oxlint-disable-next-line typescript/only-throw-error
    if (!page) throw notFound()

    const ancestors = getBreadcrumbItems(page.url, source.getPageTree(), {})
      .slice(0, -1)
      .reverse()
      .flatMap((item) => (typeof item.name === 'string' ? [item.name] : []))

    return {
      description: page.data.description,
      githubUrl: docsGithubUrl(page.path),
      markdownUrl: encodeMarkdownUrl(page.slugs),
      metaTitle: [page.data.title, ...ancestors].join(' - '),
      path: page.path,
    }
  })

export type DocsPageData = Awaited<ReturnType<typeof getDocsPage>>

export const getDocsPageTree = createServerFn({ method: 'GET' }).handler(
  async () => await source.serializePageTree(source.getPageTree()),
)
