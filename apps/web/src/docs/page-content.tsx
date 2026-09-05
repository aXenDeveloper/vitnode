import type { DocsPageData } from './transport'

import { docsClientLoader } from './client-loader'

export const DocsPageContent = (page: DocsPageData): React.ReactNode =>
  docsClientLoader.useContent(page.path, {
    description: page.description,
    full: page.full,
    githubUrl: page.githubUrl,
    title: page.title,
    url: page.url,
  })
