import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBreadcrumbItems } from 'fumadocs-core/breadcrumb'
import { z } from 'zod'

import { docsSectionTitle, loadDocsPageTreeIcons } from './icons.server'
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

    const tree = source.getPageTree()
    const ancestors = getBreadcrumbItems(page.url, tree, {})
      .slice(0, -1)
      .reverse()
      .flatMap((item) => (typeof item.name === 'string' ? [item.name] : []))
    const section = page.slugs[0]
    const sectionTitle = docsSectionTitle(tree, page.url)

    return {
      description: page.data.description,
      githubUrl: docsGithubUrl(page.path),
      markdownUrl: encodeMarkdownUrl(page.slugs),
      metaTitle: [page.data.title, ...ancestors].join(' - '),
      path: page.path,
      section:
        section && sectionTitle ? { id: section, title: sectionTitle } : null,
      url: page.url,
    }
  })

export type DocsPageData = Awaited<ReturnType<typeof getDocsPage>>

export const getDocsPageTree = createServerFn({ method: 'GET' }).handler(
  async () => {
    const tree = source.getPageTree()
    const [pageTree, icons] = await Promise.all([
      source.serializePageTree(tree),
      loadDocsPageTreeIcons(tree),
    ])

    return { icons, pageTree }
  },
)
