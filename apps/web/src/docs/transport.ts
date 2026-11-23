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
      .flatMap(({ name, url }) =>
        typeof name === 'string' ? [{ name, url: url ?? null }] : [],
      )
    const section = page.slugs[0]
    const sectionTitle = docsSectionTitle(tree, page.url)
    const titleTrail =
      ancestors.length > 0 || !sectionTitle
        ? ancestors.map(({ name }) => name).reverse()
        : [sectionTitle]
    const sectionUrl = section ? `/docs/${section}` : null

    return {
      breadcrumbs: [
        ...(sectionTitle && sectionUrl && sectionUrl !== page.url
          ? [{ name: sectionTitle, url: sectionUrl }]
          : []),
        ...ancestors,
        { name: page.data.title, url: page.url },
      ],
      description: page.data.description,
      githubUrl: docsGithubUrl(page.path),
      markdownUrl: encodeMarkdownUrl(page.slugs),
      metaTitle: [page.data.title, ...titleTrail].join(' - '),
      path: page.path,
      section:
        section && sectionTitle ? { id: section, title: sectionTitle } : null,
      title: page.data.title,
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
