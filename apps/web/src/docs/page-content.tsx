import { useRouterState } from '@tanstack/react-router'
import { usePathname } from 'fumadocs-core/framework'
import { DocsBody, DocsPage } from 'fumadocs-ui/layouts/spacious/page'
import { use, useEffect } from 'react'

import type { DocsPageData } from './transport'

import { getMDXComponents } from './mdx-components'
import { DocsPageFooter } from './page-footer'
import { DocsPageHeader } from './page-header'
import { docs } from './source'

const ScrollToHash = () => {
  const hash = useRouterState({ select: (state) => state.location.hash })

  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView()
  }, [hash])

  return null
}

export const DocsPageContent = ({
  githubUrl,
  markdownUrl,
  path,
  url,
}: DocsPageData) => {
  const pathname = usePathname()
  const page = docs.getPage(path)

  if (!page) throw new Error(`Unknown docs page: ${path}`)

  const { toc } = use(page.load())
  const MDX = page.body

  return (
    <DocsPage
      breadcrumb={{ enabled: false }}
      className="pt-4 md:pt-0"
      key={pathname}
      slots={{ footer: DocsPageFooter }}
      tableOfContent={{ single: false, style: 'clerk' }}
      toc={toc}
    >
      <DocsPageHeader
        description={page.description}
        githubUrl={githubUrl}
        implementation={page.implementation}
        markdownUrl={markdownUrl}
        title={page.title}
        url={url}
      />

      <DocsBody className="pt-2">
        <MDX components={getMDXComponents()} />
        <ScrollToHash />
      </DocsBody>
    </DocsPage>
  )
}
