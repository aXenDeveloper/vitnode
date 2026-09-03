import type { SerializedPageTree } from 'fumadocs-core/source/client'

import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { docsGithubUrl } from './github'

const docsSlugSchema = z
  .string()
  .max(512)
  .transform((splat) => splat.split('/').filter(Boolean))

export const getDocsPage = createServerFn()
  .validator(docsSlugSchema)
  .handler(async ({ data: slugs }) => {
    const [{ getBreadcrumbItems }, { source }] = await Promise.all([
      import('fumadocs-core/breadcrumb'),
      import('./source.server'),
    ])
    const page = source.getPage(slugs)

    // eslint-disable-next-line @typescript-eslint/only-throw-error
    if (!page) throw notFound()

    const ancestors = getBreadcrumbItems(page.url, source.pageTree, {})
      .slice(0, -1)
      .reverse()
      // `name` is a `ReactNode`, so a crumb whose label carries markup is an
      // element rather than a string. Only the plain ones can go in a `<title>`.
      .flatMap((item) => (typeof item.name === 'string' ? [item.name] : []))

    return {
      description: page.data.description,
      full: page.data.full ?? false,
      githubUrl: docsGithubUrl(page.path),
      metaTitle: [page.data.title, ...ancestors].join(' - '),
      path: page.path,
      title: page.data.title,
      url: page.url,
    }
  })

/** Everything a docs page route knows about its document before it renders. */
export type DocsPageData = Awaited<ReturnType<typeof getDocsPage>>

export const getDocsPageTree = createServerFn().handler(
  async (): Promise<SerializedPageTree> => {
    const { source } = await import('./source.server')

    return await source.serializePageTree(source.pageTree)
  },
)
