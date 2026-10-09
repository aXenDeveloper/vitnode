import { DocsBody, DocsPage } from 'fumadocs-ui/layouts/spacious/page'
import { use } from 'react'

import type { DocsPageData } from './transport'

import { getMDXComponents } from './mdx-components'
import { DocsPageFooter } from './page-footer'
import { DocsPageHeader } from './page-header'
import { docs } from './source'

export const DocsPageContent = ({
  githubUrl,
  markdownUrl,
  path,
}: DocsPageData) => {
  const page = docs.getPage(path)

  if (!page) throw new Error(`Unknown docs page: ${path}`)

  const { toc } = use(page.load())
  const MDX = page.body

  return (
    <DocsPage
      breadcrumb={{ enabled: false }}
      slots={{ footer: DocsPageFooter }}
      tableOfContent={{ single: false, style: 'clerk' }}
      toc={toc}
    >
      <DocsPageHeader
        description={page.description}
        githubUrl={githubUrl}
        markdownUrl={markdownUrl}
        title={page.title}
      />

      <DocsBody className="pt-2">
        <MDX components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  )
}
